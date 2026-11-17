import fs from "node:fs";
import path from "node:path";
import { DATA_PROCESSED_DIR } from "../config";
import type {
  ArticleChunk,
  Booking,
  Doctor,
  Facility,
  RagDocument,
  Slot,
  Specialty,
} from "./types";

function load<T>(file: string, fallback: T): T {
  const p = path.join(DATA_PROCESSED_DIR, file);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

export interface DataStore {
  specialties: Specialty[];
  facilities: Facility[];
  doctors: Doctor[];
  slots: Slot[];
  chunks: ArticleChunk[];
  ragDocs: RagDocument[];
  bookings: Booking[];
  slotById: Map<string, Slot>;
  doctorById: Map<string, Doctor>;
  /** slotId -> bookingId cua booking dang confirmed (chong dat trung) */
  bookedSlotIds: Map<string, string>;
  /** idempotencyKey -> booking */
  bookingsByKey: Map<string, Booking>;
}

let cache: DataStore | null = null;

export function getStore(): DataStore {
  if (cache) return cache;
  const doctors = load<Doctor[]>("doctors.json", []);
  const slots = load<Slot[]>("slots.json", []);
  const bookings = load<Booking[]>("bookings.json", []);
  const store: DataStore = {
    specialties: load<Specialty[]>("specialties.json", []),
    facilities: load<Facility[]>("facilities.json", []),
    doctors,
    slots,
    chunks: load<ArticleChunk[]>("article-chunks.json", []),
    ragDocs: load<RagDocument[]>("rag-documents.json", []),
    bookings,
    slotById: new Map(slots.map((s) => [s.slotId, s])),
    doctorById: new Map(doctors.map((d) => [String(d.id), d])),
    bookedSlotIds: new Map(),
    bookingsByKey: new Map(),
  };
  for (const b of bookings) {
    if (b.status === "confirmed") store.bookedSlotIds.set(b.slotId, b.bookingId);
    store.bookingsByKey.set(b.idempotencyKey, b);
  }
  cache = store;
  return store;
}

export function persistBookings(): void {
  const store = getStore();
  fs.mkdirSync(DATA_PROCESSED_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_PROCESSED_DIR, "bookings.json"),
    JSON.stringify(store.bookings, null, 2),
    "utf8",
  );
}
