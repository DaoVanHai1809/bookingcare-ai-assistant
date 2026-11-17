import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { formatPrice, type Card } from "../common/cards";
import type { Doctor } from "../data/types";
import { BookingEntity } from "../database/entities/booking.entity";
import { DoctorEntity } from "../database/entities/doctor.entity";
import { FacilityEntity } from "../database/entities/facility.entity";
import { SlotEntity } from "../database/entities/slot.entity";
import { SpecialtyEntity } from "../database/entities/specialty.entity";
import { normalizeText } from "../rag/vectorStore";

/** Chuyen entity (cot nullable tra null) ve dung shape Doctor cua du lieu goc. */
export function toDoctor(d: DoctorEntity): Doctor {
  return {
    id: d.id,
    name: d.name,
    url: d.url ?? undefined,
    page_url: d.page_url ?? undefined,
    photo: d.photo ?? undefined,
    summary: d.summary ?? undefined,
    province: d.province ?? undefined,
    specialties: d.specialties,
    schedule: d.schedule,
  };
}

function doctorPriceRange(d: Doctor): { min: number | null; max: number | null } {
  const mins = (d.schedule ?? [])
    .map((s) => s.price_min)
    .filter((p): p is number => typeof p === "number");
  const maxs = (d.schedule ?? [])
    .map((s) => s.price_max ?? s.price_min)
    .filter((p): p is number => typeof p === "number");
  return {
    min: mins.length ? Math.min(...mins) : null,
    max: maxs.length ? Math.max(...maxs) : null,
  };
}

export interface SearchDoctorsParams {
  specialty?: string;
  province?: string;
  date?: string; // YYYY-MM-DD
  limit?: number;
}

export interface SearchFacilitiesParams {
  keyword?: string;
  province?: string;
  limit?: number;
}

/**
 * Tim kiem bac si / co so y te — doc qua TypeORM repository (DB), khong doc
 * file JSON truc tiep. Logic loc giu nguyen tu ban Express truoc day.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(DoctorEntity)
    private readonly doctorRepo: Repository<DoctorEntity>,
    @InjectRepository(FacilityEntity)
    private readonly facilityRepo: Repository<FacilityEntity>,
    @InjectRepository(SpecialtyEntity)
    private readonly specialtyRepo: Repository<SpecialtyEntity>,
    @InjectRepository(SlotEntity)
    private readonly slotRepo: Repository<SlotEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepo: Repository<BookingEntity>,
  ) {}

  async counts(): Promise<{
    specialties: number;
    doctors: number;
    facilities: number;
    slots: number;
  }> {
    const [specialties, doctors, facilities, slots] = await Promise.all([
      this.specialtyRepo.count(),
      this.doctorRepo.count(),
      this.facilityRepo.count(),
      this.slotRepo.count(),
    ]);
    return { specialties, doctors, facilities, slots };
  }

  async searchDoctors(params: SearchDoctorsParams): Promise<{
    doctors: Doctor[];
    cards: Card[];
  }> {
    const limit = Math.min(params.limit ?? 5, 10);
    const specQ = params.specialty ? normalizeText(params.specialty) : "";
    const provQ = params.province ? normalizeText(params.province) : "";

    let doctors: Doctor[] = (await this.doctorRepo.find()).map(toDoctor);
    doctors = doctors.filter((d) => {
      if (specQ) {
        const matchSpec = d.specialties.some((s) =>
          normalizeText(s.name).includes(specQ),
        );
        // Cho phep tim theo tu khoa trong tom tat (vi du "cot song")
        const matchSummary = normalizeText(d.summary ?? "").includes(specQ);
        if (!matchSpec && !matchSummary) return false;
      }
      if (provQ && !normalizeText(d.province ?? "").includes(provQ)) return false;
      return true;
    });

    if (params.date) {
      const rows = await this.slotRepo.find({
        where: { date: params.date },
        select: { doctorId: true },
      });
      const idsWithSlots = new Set(rows.map((r) => r.doctorId));
      doctors = doctors.filter((d) => idsWithSlots.has(String(d.id)));
    }
    doctors = doctors.slice(0, limit);

    // So slot con trong vao ngay da chon (neu co) cho tung bac si
    let availableCount: Map<string, number> | null = null;
    if (params.date && doctors.length) {
      const daySlots = await this.slotRepo.find({
        where: {
          date: params.date,
          doctorId: In(doctors.map((d) => String(d.id))),
        },
      });
      const booked = daySlots.length
        ? await this.bookingRepo.find({
            where: {
              slotId: In(daySlots.map((s) => s.slotId)),
              status: "confirmed",
            },
            select: { slotId: true },
          })
        : [];
      const bookedIds = new Set(booked.map((b) => b.slotId));
      availableCount = new Map<string, number>();
      for (const s of daySlots) {
        if (s.status === "available" && !bookedIds.has(s.slotId)) {
          availableCount.set(s.doctorId, (availableCount.get(s.doctorId) ?? 0) + 1);
        }
      }
    }

    const cards: Card[] = doctors.map((d) => {
      const price = doctorPriceRange(d);
      const facilities = [
        ...new Map(
          (d.schedule ?? []).map((s) => [
            s.facility_id,
            { id: s.facility_id, name: s.facility_name, address: s.facility_address },
          ]),
        ).values(),
      ];
      return {
        type: "doctor",
        doctorId: String(d.id),
        name: d.name,
        photo: d.photo,
        specialties: d.specialties,
        province: d.province,
        summary: d.summary,
        priceMin: price.min,
        priceMax: price.max,
        priceLabel: formatPrice(price.min, price.max),
        facilities,
        pageUrl: d.page_url,
        ...(availableCount
          ? { availableOnDate: availableCount.get(String(d.id)) ?? 0 }
          : {}),
      } as Card;
    });

    return { doctors, cards };
  }

  async searchFacilities(params: SearchFacilitiesParams): Promise<{
    cards: Card[];
    count: number;
  }> {
    const limit = Math.min(params.limit ?? 5, 10);
    const kw = params.keyword ? normalizeText(params.keyword) : "";
    const provQ = params.province ? normalizeText(params.province) : "";
    const all = await this.facilityRepo.find();
    const facilities = all
      .filter((f) => {
        if (kw) {
          const hay = normalizeText(`${f.name} ${f.address ?? ""} ${f.description ?? ""}`);
          if (!hay.includes(kw)) return false;
        }
        if (provQ) {
          const hay = normalizeText(`${f.province ?? ""} ${f.address ?? ""}`);
          if (!hay.includes(provQ)) return false;
        }
        return true;
      })
      .slice(0, limit);
    return {
      count: facilities.length,
      cards: facilities.map((f) => ({
        type: "facility",
        facilityId: f.id,
        name: f.name,
        address: f.address,
        province: f.province,
        description: f.description,
        image: f.image,
        pageUrl: f.page_url,
      })),
    };
  }
}
