export interface Specialty {
  id: number;
  name: string;
  url: string;
  page_url?: string;
  description?: string;
}

export interface Facility {
  id: number;
  name: string;
  url?: string;
  page_url?: string;
  address?: string;
  province?: string;
  latitude?: string;
  longitude?: string;
  image?: string;
  description?: string;
}

export interface DoctorScheduleEntry {
  /** 1 = Thu 2 (Mon) ... 6 = Thu 7 (Sat), 7 = Chu nhat (Sun) — quy uoc cua du lieu goc */
  weekday: number;
  session: number;
  facility_id: number;
  facility_name: string;
  facility_address: string;
  price_min: number | null;
  price_max: number | null;
  time_slots: string[]; // "09:00 - 09:30"
}

export interface Doctor {
  id: string;
  name: string;
  url?: string;
  page_url?: string;
  photo?: string;
  summary?: string;
  province?: string;
  specialties: { id: number; name: string }[];
  schedule: DoctorScheduleEntry[];
}

export interface Article {
  id: number;
  title: string;
  url?: string;
  page_url?: string;
  summary?: string;
  content_text: string;
  category?: string | null;
  published_time?: string;
  specialties?: { id: number; name: string }[];
}

export interface ArticleChunk {
  id: string;
  articleId: number;
  title: string;
  url?: string;
  page_url?: string;
  category?: string | null;
  specialties: { id: number; name: string }[];
  chunkIndex: number;
  text: string;
}

export type SlotStatus = "available" | "full";

export interface Slot {
  slotId: string;
  doctorId: string;
  doctorName: string;
  facilityId: number;
  facilityName: string;
  facilityAddress: string;
  /** YYYY-MM-DD (gio dia phuong Asia/Ho_Chi_Minh) */
  date: string;
  weekday: number; // quy uoc goc: 1=Mon..7=Sun
  start: string; // "09:00"
  end: string; // "09:30"
  label: string; // "09:00 - 09:30"
  priceMin: number | null;
  priceMax: number | null;
  status: SlotStatus;
}

export type BookingStatus = "confirmed" | "cancelled";

export interface Booking {
  bookingId: string;
  slotId: string;
  doctorId: string;
  doctorName: string;
  facilityName: string;
  facilityAddress: string;
  date: string;
  timeLabel: string;
  priceMin: number | null;
  priceMax: number | null;
  patientName: string;
  phone: string;
  idempotencyKey: string;
  status: BookingStatus;
  /** Mo phong giu cho: thoi diem het han giu cho (da xac nhan ngay trong ban demo) */
  holdExpiresAt: string;
  createdAt: string;
}

/** Mot tai lieu dua vao RAG (chunk bai viet / ho so bac si / co so). */
export interface RagDocument {
  id: string;
  type: "article" | "doctor" | "facility";
  refId: string;
  title: string;
  url?: string;
  text: string;
  metadata: Record<string, unknown>;
}

export interface VectorIndexFile {
  model: string;
  createdAt: string;
  docs: (RagDocument & { embedding: number[] })[];
}
