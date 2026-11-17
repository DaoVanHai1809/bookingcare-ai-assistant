import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SessionBookingStateEntity } from "../database/entities/session-booking-state.entity";
import { SlotEntity } from "../database/entities/slot.entity";

/**
 * May trang thai dat lich theo phien — toan bo logic xac dinh o backend:
 * - pinDoctor: khi check_slots thanh cong, ghim bac si + ngay dang chon,
 *   xoa slot/booking cu (bat dau lai luong chon).
 * - pinSlot: ghim khung gio vua dat.
 * - markBooked: danh dau da dat thanh cong kem ma booking.
 * Agent doc trang thai nay qua system prompt va create_booking bi chan
 * neu slot lech bac si da ghim (xem agent/tools.ts).
 */
@Injectable()
export class BookingStateService {
  constructor(
    @InjectRepository(SessionBookingStateEntity)
    private readonly repo: Repository<SessionBookingStateEntity>,
    @InjectRepository(SlotEntity)
    private readonly slotRepo: Repository<SlotEntity>,
  ) {}

  async get(sessionId: string): Promise<SessionBookingStateEntity | null> {
    return this.repo.findOneBy({ sessionId });
  }

  /**
   * Ghi trang thai bang save() — TypeORM upsert theo khoa chinh sessionId,
   * code cua minh khong tu find-then-insert. Cac cot khong co trong patch
   * (undefined) khong bi ghi de khi update; pinDoctor truyen null tuong minh
   * cho cac cot slot/booking de xoa sach khi ghim bac si moi.
   */
  private async write(
    sessionId: string,
    patch: Partial<SessionBookingStateEntity>,
  ): Promise<SessionBookingStateEntity> {
    const entity = this.repo.create({
      ...patch,
      sessionId,
      updatedAt: new Date().toISOString(),
    });
    return this.repo.save(entity);
  }

  /**
   * Invariant nhat quan bac si — nam o service layer, tool chi goi va bao loi:
   * - Chua ghim bac si nao -> ok.
   * - Slot khong ton tai -> ok (de createBooking tra SLOT_NOT_FOUND).
   * - Slot thuoc dung bac si da ghim -> ok (ke ca khi step="booked":
   *   dat them cho nguoi than cung bac si la luong hop le).
   * - Slot thuoc bac si khac -> khong ok, tra kem bac si da ghim.
   */
  async validateSlot(
    sessionId: string,
    slotId: string,
  ): Promise<
    { ok: true } | { ok: false; doctorId: string; doctorName: string }
  > {
    const st = await this.get(sessionId);
    if (!st?.doctorId) return { ok: true };
    const slot = await this.slotRepo.findOneBy({ slotId: String(slotId) });
    if (!slot) return { ok: true };
    if (slot.doctorId === st.doctorId) return { ok: true };
    return {
      ok: false,
      doctorId: st.doctorId,
      doctorName: st.doctorName ?? "",
    };
  }

  async pinDoctor(
    sessionId: string,
    data: { doctorId: string; doctorName: string; date: string },
  ): Promise<SessionBookingStateEntity> {
    return this.write(sessionId, {
      step: "doctor",
      doctorId: data.doctorId,
      doctorName: data.doctorName,
      date: data.date,
      slotId: null,
      timeLabel: null,
      facilityName: null,
      bookingId: null,
    });
  }

  async pinSlot(
    sessionId: string,
    data: { slotId: string; timeLabel: string; facilityName: string },
  ): Promise<SessionBookingStateEntity> {
    return this.write(sessionId, {
      step: "slot",
      slotId: data.slotId,
      timeLabel: data.timeLabel,
      facilityName: data.facilityName,
    });
  }

  async markBooked(
    sessionId: string,
    bookingId: string,
  ): Promise<SessionBookingStateEntity> {
    return this.write(sessionId, { step: "booked", bookingId });
  }

  async clear(sessionId: string): Promise<void> {
    await this.repo.delete({ sessionId });
  }
}
