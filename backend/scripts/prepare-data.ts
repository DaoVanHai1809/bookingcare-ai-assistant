/**
 * Xu ly du lieu tho (data/raw) -> du lieu chuan hoa (data/processed).
 *
 * Chay: npm run data:prepare
 *
 * Dau ra:
 *  - specialties.json / facilities.json / doctors.json: chuan hoa tu raw
 *  - slots.json: lich kham cu the cho 14 ngay toi, sinh tu mau "thu trong tuan"
 *    cua tung buoi kham; mot so slot danh dau "full" bang RNG co seed co dinh
 *    (tai lap duoc), slot da qua gio trong ngay hom nay cung la "full".
 *  - article-chunks.json: bai cam nang cat doan ~500-800 ky tu + metadata
 *  - rag-documents.json: tap tai lieu cho RAG (chunk bai viet + ho so bac si/co so)
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_PROCESSED_DIR, DATA_RAW_DIR } from "../src/config";
import type {
  Article,
  ArticleChunk,
  Doctor,
  Facility,
  RagDocument,
  Slot,
  Specialty,
} from "../src/data/types";

/** RNG deterministic (mulberry32) de viec danh dau slot "full" tai lap duoc. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_RAW_DIR, file), "utf8")) as T;
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(DATA_PROCESSED_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_PROCESSED_DIR, file),
    JSON.stringify(data, null, 2),
    "utf8",
  );
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Cat van ban thanh doan ~500-800 ky tu, uu tien cat tai ranh gioi cau/doan. */
export function chunkText(text: string, target = 700, max = 800): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let rest = clean;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(". ", target);
    if (cut < 400) cut = rest.lastIndexOf(" ", target);
    if (cut < 400) cut = target;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter((c) => c.length >= 80);
}

function main(): void {
  const specialties = readJson<Specialty[]>("specialties.json");
  const facilities = readJson<Facility[]>("facilities.json");
  const doctors = readJson<Doctor[]>("doctors.json");
  const articles = readJson<Article[]>("articles.json");

  writeJson("specialties.json", specialties);
  writeJson("facilities.json", facilities);
  writeJson("doctors.json", doctors);

  // --- Sinh lich kham cu the cho 14 ngay toi ---
  const rng = mulberry32(20261117);
  const FULL_RATIO = 0.25;
  const slots: Slot[] = [];
  const now = new Date();
  for (let offset = 0; offset < 14; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const jsDay = date.getDay(); // 0=Sun..6=Sat
    const dataWeekday = jsDay === 0 ? 7 : jsDay; // 1=Mon..6=Sat, 7=Sun
    const dateStr = fmtDate(date);
    for (const doctor of doctors) {
      for (const entry of doctor.schedule ?? []) {
        if (entry.weekday !== dataWeekday) continue;
        for (const label of entry.time_slots ?? []) {
          const [startRaw, endRaw] = label.split("-").map((s) => s.trim());
          if (!startRaw || !endRaw) continue;
          const [hh, mm] = startRaw.split(":").map(Number);
          const slotTime = new Date(date);
          slotTime.setHours(hh || 0, mm || 0, 0, 0);
          const isPast = offset === 0 && slotTime.getTime() <= now.getTime();
          const status = isPast || rng() < FULL_RATIO ? "full" : "available";
          slots.push({
            slotId: `slot_${doctor.id}_${dateStr}_${startRaw.replace(":", "")}`,
            doctorId: String(doctor.id),
            doctorName: doctor.name,
            facilityId: entry.facility_id,
            facilityName: entry.facility_name,
            facilityAddress: entry.facility_address,
            date: dateStr,
            weekday: dataWeekday,
            start: startRaw,
            end: endRaw,
            label,
            priceMin: entry.price_min,
            priceMax: entry.price_max,
            status,
          });
        }
      }
    }
  }
  slots.sort((a, b) =>
    `${a.date} ${a.start} ${a.doctorId}`.localeCompare(`${b.date} ${b.start} ${b.doctorId}`),
  );
  writeJson("slots.json", slots);

  // --- Chunk bai viet ---
  const chunks: ArticleChunk[] = [];
  for (const article of articles) {
    const parts = chunkText(article.content_text ?? "");
    parts.forEach((text, i) => {
      chunks.push({
        id: `art_${article.id}_c${i}`,
        articleId: article.id,
        title: article.title,
        url: article.url,
        page_url: article.page_url,
        category: article.category ?? null,
        specialties: article.specialties ?? [],
        chunkIndex: i,
        text,
      });
    });
  }
  writeJson("article-chunks.json", chunks);

  // --- Tap tai lieu RAG ---
  const ragDocs: RagDocument[] = [];
  for (const c of chunks) {
    ragDocs.push({
      id: c.id,
      type: "article",
      refId: String(c.articleId),
      title: c.title,
      url: c.page_url,
      text: c.text,
      metadata: { category: c.category, specialties: c.specialties },
    });
  }
  for (const d of doctors) {
    const facNames = [...new Set((d.schedule ?? []).map((s) => s.facility_name))];
    const prices = (d.schedule ?? [])
      .map((s) => s.price_min)
      .filter((p): p is number => typeof p === "number");
    const text = [
      `Bác sĩ ${d.name}.`,
      `Chuyên khoa: ${d.specialties.map((s) => s.name).join(", ") || "chưa rõ"}.`,
      d.summary ? `Kinh nghiệm và giới thiệu: ${d.summary}` : "",
      d.province ? `Tỉnh/thành: ${d.province}.` : "",
      facNames.length ? `Nơi khám: ${facNames.join("; ")}.` : "",
      prices.length ? `Giá khám từ ${Math.min(...prices).toLocaleString("vi-VN")} đồng.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    ragDocs.push({
      id: `doc_${d.id}`,
      type: "doctor",
      refId: String(d.id),
      title: d.name,
      url: d.page_url,
      text,
      metadata: { province: d.province, specialties: d.specialties },
    });
  }
  for (const f of facilities) {
    const text = [
      `Cơ sở y tế ${f.name}.`,
      f.address ? `Địa chỉ: ${f.address.replace(/\s+/g, " ")}.` : "",
      f.province ? `Tỉnh/thành: ${f.province}.` : "",
      f.description ? `Giới thiệu: ${f.description}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    ragDocs.push({
      id: `fac_${f.id}`,
      type: "facility",
      refId: String(f.id),
      title: f.name,
      url: f.page_url,
      text,
      metadata: { province: f.province },
    });
  }
  writeJson("rag-documents.json", ragDocs);

  const available = slots.filter((s) => s.status === "available").length;
  console.log(
    `[prepare-data] specialties=${specialties.length} facilities=${facilities.length} ` +
      `doctors=${doctors.length} articles=${articles.length} chunks=${chunks.length} ` +
      `slots=${slots.length} (available=${available}, full=${slots.length - available}) ` +
      `ragDocs=${ragDocs.length}`,
  );
  console.log(`[prepare-data] da ghi vao ${DATA_PROCESSED_DIR}`);
}

main();
