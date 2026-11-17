import fs from "node:fs";
import path from "node:path";
import type { DataSource, EntityTarget, ObjectLiteral } from "typeorm";
import { DATA_PROCESSED_DIR } from "../config";
import type {
  ArticleChunk,
  Booking,
  Doctor,
  Facility,
  Slot,
  Specialty,
} from "../data/types";
import { ArticleChunkEntity } from "./entities/article-chunk.entity";
import { BookingEntity } from "./entities/booking.entity";
import { DoctorEntity } from "./entities/doctor.entity";
import { FacilityEntity } from "./entities/facility.entity";
import { SlotEntity } from "./entities/slot.entity";
import { SpecialtyEntity } from "./entities/specialty.entity";

function load<T>(file: string, fallback: T): T {
  const p = path.join(DATA_PROCESSED_DIR, file);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

async function insertInChunks<T extends ObjectLiteral>(
  ds: DataSource,
  target: EntityTarget<T>,
  rows: T[],
  chunkSize = 500,
): Promise<void> {
  const repo = ds.getRepository(target);
  for (let i = 0; i < rows.length; i += chunkSize) {
    await repo.save(rows.slice(i, i + chunkSize) as T[]);
  }
}

export interface SeedResult {
  specialties: number;
  facilities: number;
  doctors: number;
  slots: number;
  articleChunks: number;
  bookings: number;
}

/**
 * Nap du lieu tu data/processed/*.json vao DB.
 * - force=false: chi nap khi bang doctors dang rong (dung luc khoi dong app).
 * - force=true: xoa sach cac bang roi nap lai (dung boi `npm run db:seed`).
 */
export async function seedFromProcessed(
  ds: DataSource,
  opts: { force?: boolean } = {},
): Promise<SeedResult> {
  const force = opts.force ?? false;
  const doctorRepo = ds.getRepository(DoctorEntity);
  const existing = await doctorRepo.count();
  if (!force && existing > 0) {
    return {
      specialties: await ds.getRepository(SpecialtyEntity).count(),
      facilities: await ds.getRepository(FacilityEntity).count(),
      doctors: existing,
      slots: await ds.getRepository(SlotEntity).count(),
      articleChunks: await ds.getRepository(ArticleChunkEntity).count(),
      bookings: await ds.getRepository(BookingEntity).count(),
    };
  }

  if (force) {
    // Xoa theo thu tu tranh rang buoc tham chieu (hien chua co FK, van an toan)
    await ds.getRepository(BookingEntity).clear();
    await ds.getRepository(SlotEntity).clear();
    await ds.getRepository(DoctorEntity).clear();
    await ds.getRepository(FacilityEntity).clear();
    await ds.getRepository(SpecialtyEntity).clear();
    await ds.getRepository(ArticleChunkEntity).clear();
  }

  const specialties = load<Specialty[]>("specialties.json", []);
  const facilities = load<Facility[]>("facilities.json", []);
  const doctors = load<Doctor[]>("doctors.json", []);
  // slots.json co 58 slotId bi trung (cung bac si/ngay/gio sinh tu 2 buoi kham
  // chong nhau, chi khac co "full" ngau nhien) — DB khoa chinh slotId nen
  // khử trùng, giu ban ghi dau tien. Ban in-memory cu giu ca hai dong.
  const rawSlots = load<Slot[]>("slots.json", []);
  const seenSlotIds = new Set<string>();
  const slots = rawSlots.filter((s) => {
    if (seenSlotIds.has(s.slotId)) return false;
    seenSlotIds.add(s.slotId);
    return true;
  });
  const chunks = load<ArticleChunk[]>("article-chunks.json", []);
  const bookings = load<Booking[]>("bookings.json", []);

  await insertInChunks(ds, SpecialtyEntity, specialties as SpecialtyEntity[]);
  await insertInChunks(ds, FacilityEntity, facilities as FacilityEntity[]);
  await insertInChunks(ds, DoctorEntity, doctors as DoctorEntity[]);
  await insertInChunks(ds, SlotEntity, slots as SlotEntity[]);
  await insertInChunks(ds, ArticleChunkEntity, chunks as ArticleChunkEntity[]);
  await insertInChunks(ds, BookingEntity, bookings as BookingEntity[]);

  return {
    specialties: specialties.length,
    facilities: facilities.length,
    doctors: doctors.length,
    slots: slots.length,
    articleChunks: chunks.length,
    bookings: bookings.length,
  };
}
