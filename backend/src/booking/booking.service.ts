import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { toDoctor } from "../catalog/catalog.service";
import { formatPrice, type Card } from "../common/cards";
import type { Booking, Doctor, Slot } from "../data/types";
import { BookingEntity } from "../database/entities/booking.entity";
import { DoctorEntity } from "../database/entities/doctor.entity";
import { SlotEntity } from "../database/entities/slot.entity";

export interface CreateBookingParams {
  slotId: string;
  patientName: string;
  phone: string;
  idempotencyKey?: string;
}

export type CreateBookingResult =
  | { ok: true; duplicated: boolean; booking: Booking; card: Card }
  | { ok: false; error: string; code: string };

function bookingCard(b: Booking): Card {
  return {
    type: "booking",
    bookingId: b.bookingId,
    status: b.status,
    doctorId: b.doctorId,
    doctorName: b.doctorName,
    facilityName: b.facilityName,
    facilityAddress: b.facilityAddress,
    date: b.date,
    timeLabel: b.timeLabel,
    priceLabel: formatPrice(b.priceMin, b.priceMax),
    patientName: b.patientName,
    phone: b.phone,
    holdExpiresAt: b.holdExpiresAt,
    createdAt: b.createdAt,
  };
}

/**
 * Kiem tra slot va dat lich MO PHONG — logic xac dinh hoan toan o backend,
 * du lieu doc/ghi qua TypeORM repository:
 * - Idempotency: cung idempotencyKey (mac dinh slotId|phone) tra lai booking cu.
 * - Chong dat trung: slot da co booking confirmed hoac da "full" thi tu choi.
 * - Giu cho + xac nhan: booking tao ra o trang thai confirmed ngay (mo phong),
 *   kem holdExpiresAt de frontend hien thi thoi han giu cho.
 */
@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(DoctorEntity)
    private readonly doctorRepo: Repository<DoctorEntity>,
    @InjectRepository(SlotEntity)
    private readonly slotRepo: Repository<SlotEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepo: Repository<BookingEntity>,
  ) {}

  async countBookings(): Promise<number> {
    return this.bookingRepo.count();
  }

  /** Tra cuu xac dinh mot slot theo slotId (dung cho guardrail ghim bac si). */
  async findSlot(slotId: string): Promise<SlotEntity | null> {
    return this.slotRepo.findOneBy({ slotId: String(slotId) });
  }

  async checkSlots(
    doctorId: string,
    date: string,
  ): Promise<{ doctor: Doctor; slots: Slot[]; card: Card } | { error: string }> {
    const doctor = await this.doctorRepo.findOneBy({ id: String(doctorId) });
    if (!doctor) return { error: `Không tìm thấy bác sĩ với mã ${doctorId}.` };
    const rawSlots = await this.slotRepo.find({
      where: { doctorId: String(doctorId), date },
      order: { start: "ASC" },
    });
    const booked = rawSlots.length
      ? await this.bookingRepo.find({
          where: {
            slotId: In(rawSlots.map((s) => s.slotId)),
            status: "confirmed",
          },
          select: { slotId: true },
        })
      : [];
    const bookedIds = new Set(booked.map((b) => b.slotId));
    const slots: Slot[] = rawSlots.map((s) => ({
      ...s,
      status: bookedIds.has(s.slotId) ? ("full" as const) : s.status,
    }));
    const card: Card = {
      type: "slots",
      doctorId: String(doctor.id),
      doctorName: doctor.name,
      date,
      slots: slots.map((s) => ({
        slotId: s.slotId,
        start: s.start,
        end: s.end,
        label: s.label,
        facilityName: s.facilityName,
        facilityAddress: s.facilityAddress,
        priceMin: s.priceMin,
        priceMax: s.priceMax,
        priceLabel: formatPrice(s.priceMin, s.priceMax),
        status: s.status,
      })),
    };
    return { doctor: toDoctor(doctor), slots, card };
  }

  async createBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
    const patientName = (params.patientName ?? "").trim();
    const phone = (params.phone ?? "").replace(/[\s.]/g, "");
    if (!patientName)
      return { ok: false, error: "Thiếu họ tên người khám.", code: "MISSING_NAME" };
    if (!/^0\d{9}$/.test(phone))
      return {
        ok: false,
        error: "Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0).",
        code: "INVALID_PHONE",
      };

    const key = params.idempotencyKey || `${params.slotId}|${phone}`;
    const existing = await this.bookingRepo.findOneBy({ idempotencyKey: key });
    if (existing && existing.status === "confirmed") {
      return { ok: true, duplicated: true, booking: existing, card: bookingCard(existing) };
    }

    const slot = await this.slotRepo.findOneBy({ slotId: params.slotId });
    if (!slot)
      return {
        ok: false,
        error: `Không tìm thấy khung giờ ${params.slotId}.`,
        code: "SLOT_NOT_FOUND",
      };
    if (slot.status === "full")
      return { ok: false, error: "Khung giờ này đã hết chỗ.", code: "SLOT_FULL" };
    const taken = await this.bookingRepo.findOneBy({
      slotId: slot.slotId,
      status: "confirmed",
    });
    if (taken)
      return {
        ok: false,
        error: "Khung giờ này vừa được người khác đặt. Vui lòng chọn khung giờ khác.",
        code: "SLOT_TAKEN",
      };

    const now = new Date();
    const total = await this.bookingRepo.count();
    const booking = this.bookingRepo.create({
      bookingId: `BK${now.getTime().toString(36).toUpperCase()}${total + 1}`,
      slotId: slot.slotId,
      doctorId: slot.doctorId,
      doctorName: slot.doctorName,
      facilityName: slot.facilityName,
      facilityAddress: slot.facilityAddress,
      date: slot.date,
      timeLabel: slot.label,
      priceMin: slot.priceMin,
      priceMax: slot.priceMax,
      patientName,
      phone,
      idempotencyKey: key,
      status: "confirmed",
      holdExpiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
      createdAt: now.toISOString(),
    });
    const saved = await this.bookingRepo.save(booking);
    return { ok: true, duplicated: false, booking: saved, card: bookingCard(saved) };
  }
}
