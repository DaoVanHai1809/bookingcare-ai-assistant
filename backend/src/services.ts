import { getStore, persistBookings } from "./data/store";
import type { Booking, Doctor, Slot } from "./data/types";
import { normalizeText, ragSearch } from "./rag/vectorStore";

/** The card gui kem cho frontend qua SSE event "cards". */
export type Card =
  | { type: "doctor"; [k: string]: unknown }
  | { type: "facility"; [k: string]: unknown }
  | { type: "slots"; [k: string]: unknown }
  | { type: "booking"; [k: string]: unknown }
  | { type: "article"; [k: string]: unknown };

export function formatPrice(min: number | null, max: number | null): string {
  if (min == null && max == null) return "chưa công bố";
  if (min != null && max != null && max !== min)
    return `${min.toLocaleString("vi-VN")} - ${max.toLocaleString("vi-VN")}đ`;
  const v = (min ?? max) as number;
  return `${v.toLocaleString("vi-VN")}đ`;
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

export function searchDoctors(params: SearchDoctorsParams): {
  doctors: Doctor[];
  cards: Card[];
} {
  const store = getStore();
  const limit = Math.min(params.limit ?? 5, 10);
  const specQ = params.specialty ? normalizeText(params.specialty) : "";
  const provQ = params.province ? normalizeText(params.province) : "";

  let doctors = store.doctors.filter((d) => {
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
    doctors = doctors.filter((d) =>
      store.slots.some(
        (s) => s.doctorId === String(d.id) && s.date === params.date,
      ),
    );
  }
  doctors = doctors.slice(0, limit);

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
    let availableOnDate: number | undefined;
    if (params.date) {
      availableOnDate = store.slots.filter(
        (s) =>
          s.doctorId === String(d.id) &&
          s.date === params.date &&
          s.status === "available" &&
          !store.bookedSlotIds.has(s.slotId),
      ).length;
    }
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
      ...(availableOnDate !== undefined ? { availableOnDate } : {}),
    } as Card;
  });

  return { doctors, cards };
}

export interface SearchFacilitiesParams {
  keyword?: string;
  province?: string;
  limit?: number;
}

export function searchFacilities(params: SearchFacilitiesParams): {
  cards: Card[];
  count: number;
} {
  const store = getStore();
  const limit = Math.min(params.limit ?? 5, 10);
  const kw = params.keyword ? normalizeText(params.keyword) : "";
  const provQ = params.province ? normalizeText(params.province) : "";
  const facilities = store.facilities
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

export function checkSlots(
  doctorId: string,
  date: string,
): { doctor: Doctor; slots: Slot[]; card: Card } | { error: string } {
  const store = getStore();
  const doctor = store.doctorById.get(String(doctorId));
  if (!doctor) return { error: `Không tìm thấy bác sĩ với mã ${doctorId}.` };
  const slots = store.slots
    .filter((s) => s.doctorId === String(doctorId) && s.date === date)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((s) => ({
      ...s,
      status: store.bookedSlotIds.has(s.slotId) ? ("full" as const) : s.status,
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
  return { doctor, slots, card };
}

export interface CreateBookingParams {
  slotId: string;
  patientName: string;
  phone: string;
  idempotencyKey?: string;
}

export type CreateBookingResult =
  | { ok: true; duplicated: boolean; booking: Booking; card: Card }
  | { ok: false; error: string; code: string };

/**
 * Dat lich MO PHONG — logic xac dinh hoan toan o backend:
 * - Idempotency: cung idempotencyKey (mac dinh slotId|phone) tra lai booking cu.
 * - Chong dat trung: slot da co booking confirmed hoac da "full" thi tu choi.
 * - Giu cho + xac nhan: booking tao ra o trang thai confirmed ngay (mo phong),
 *   kem holdExpiresAt de frontend hien thi thoi han giu cho.
 */
export function createBooking(params: CreateBookingParams): CreateBookingResult {
  const store = getStore();
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
  const existing = store.bookingsByKey.get(key);
  if (existing && existing.status === "confirmed") {
    return { ok: true, duplicated: true, booking: existing, card: bookingCard(existing) };
  }

  const slot = store.slotById.get(params.slotId);
  if (!slot)
    return { ok: false, error: `Không tìm thấy khung giờ ${params.slotId}.`, code: "SLOT_NOT_FOUND" };
  if (slot.status === "full")
    return { ok: false, error: "Khung giờ này đã hết chỗ.", code: "SLOT_FULL" };
  if (store.bookedSlotIds.has(slot.slotId))
    return {
      ok: false,
      error: "Khung giờ này vừa được người khác đặt. Vui lòng chọn khung giờ khác.",
      code: "SLOT_TAKEN",
    };

  const now = new Date();
  const booking: Booking = {
    bookingId: `BK${now.getTime().toString(36).toUpperCase()}${store.bookings.length + 1}`,
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
  };
  store.bookings.push(booking);
  store.bookedSlotIds.set(slot.slotId, booking.bookingId);
  store.bookingsByKey.set(key, booking);
  persistBookings();
  return { ok: true, duplicated: false, booking, card: bookingCard(booking) };
}

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

export interface QaResult {
  passages: { title: string; url?: string; type: string; text: string; score: number }[];
  cards: Card[];
  mode: "vector" | "lexical";
}

/** Hoi dap y khoa bang RAG: truy xuat top-k=4 doan lien quan nhat. */
export async function medicalQa(query: string, k = 4): Promise<QaResult> {
  const store = getStore();
  const { hits, mode } = await ragSearch(store.ragDocs, query, k);
  const passages = hits.map((h) => ({
    title: h.doc.title,
    url: h.doc.url,
    type: h.doc.type,
    text: h.doc.text.slice(0, 700),
    score: Number(h.score.toFixed(3)),
  }));
  const cards: Card[] = hits
    .filter((h) => h.doc.type === "article")
    .map((h) => ({
      type: "article",
      title: h.doc.title,
      url: h.doc.url,
      snippet: h.doc.text.slice(0, 200),
    }));
  return { passages, cards, mode };
}
