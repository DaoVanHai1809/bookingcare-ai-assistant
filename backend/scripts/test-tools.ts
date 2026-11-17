/**
 * Kiem chung cac luong KHONG can LLM: tim kiem, slot, dat lich (idempotency +
 * chong trung), va RAG fallback. Chay: npm run test:tools
 */
import assert from "node:assert";
import { getStore } from "../src/data/store";
import { normalizeText } from "../src/rag/vectorStore";
import {
  checkSlots,
  createBooking,
  medicalQa,
  searchDoctors,
  searchFacilities,
} from "../src/services";

async function main(): Promise<void> {
  const store = getStore();
  console.log(
    `[data] doctors=${store.doctors.length} slots=${store.slots.length} chunks=${store.chunks.length}`,
  );
  assert.ok(store.doctors.length === 30, "can 30 bac si");
  assert.ok(store.slots.length > 1000, "can >1000 slot");
  assert.strictEqual(normalizeText("Đau đầu Cơ Xương Khớp"), "dau dau co xuong khop");
  console.log("[ok] normalizeText bo dau dung");

  // 1. Tim bac si theo chuyen khoa + tinh (co dau va khong dau)
  const r1 = searchDoctors({ specialty: "Cơ Xương Khớp", province: "Hà Nội" });
  assert.ok(r1.doctors.length > 0, "phai tim thay bac si CXK o Ha Noi");
  const r1b = searchDoctors({ specialty: "co xuong khop", province: "ha noi" });
  assert.strictEqual(r1b.doctors.length, r1.doctors.length);
  console.log(`[ok] search_doctors CXK/Ha Noi: ${r1.doctors.length} bac si (khong dau khop)`);
  assert.strictEqual(r1.cards[0].type, "doctor");

  // 2. Tim co so y te
  const f1 = searchFacilities({ province: "Hà Nội" });
  assert.ok(f1.count > 0, "phai tim thay co so o Ha Noi");
  console.log(`[ok] search_facilities Ha Noi: ${f1.count} co so`);

  // 3. Check slots: lay ngay dau tien co slot cua bac si dau tien
  const doctor = r1.doctors[0];
  const someSlot = store.slots.find((s) => s.doctorId === String(doctor.id));
  assert.ok(someSlot, "bac si phai co slot");
  const cs = checkSlots(String(doctor.id), someSlot!.date);
  assert.ok(!("error" in cs), "check_slots khong duoc loi");
  if (!("error" in cs)) {
    assert.ok(cs.slots.length > 0);
    console.log(
      `[ok] check_slots bac si ${doctor.id} ngay ${someSlot!.date}: ${cs.slots.length} slot`,
    );
  }

  // 4. Dat lich: chon slot con trong trong tuong lai
  const freeSlot = store.slots.find(
    (s) => s.status === "available" && !store.bookedSlotIds.has(s.slotId),
  );
  assert.ok(freeSlot, "can it nhat 1 slot con trong");
  const b1 = createBooking({
    slotId: freeSlot!.slotId,
    patientName: "Nguyễn Văn Test",
    phone: "0901234567",
  });
  assert.ok(b1.ok, "dat lich lan 1 phai thanh cong");
  console.log(`[ok] create_booking thanh cong: ${b1.ok && b1.booking.bookingId}`);

  // 5. Idempotency: goi lai cung key mac dinh (slotId|phone) -> tra booking cu
  const b2 = createBooking({
    slotId: freeSlot!.slotId,
    patientName: "Nguyễn Văn Test",
    phone: "0901234567",
  });
  assert.ok(b2.ok && b2.duplicated, "goi lai phai la duplicated");
  assert.strictEqual(b2.ok && b2.booking.bookingId, b1.ok && b1.booking.bookingId);
  console.log("[ok] idempotency: khong tao booking trung");

  // 6. Chong dat trung: nguoi khac (phone khac) dat cung slot -> bi tu choi
  const b3 = createBooking({
    slotId: freeSlot!.slotId,
    patientName: "Trần Thị Khác",
    phone: "0912345678",
  });
  assert.ok(!b3.ok && b3.code === "SLOT_TAKEN", "phai chan dat trung slot");
  console.log("[ok] chong dat trung slot: SLOT_TAKEN");

  // 7. Validate so dien thoai
  const b4 = createBooking({
    slotId: freeSlot!.slotId,
    patientName: "X",
    phone: "123",
  });
  assert.ok(!b4.ok && b4.code === "INVALID_PHONE");
  console.log("[ok] validate phone: INVALID_PHONE");

  // 8. RAG fallback (chua co key -> lexical)
  const qa = await medicalQa("đau đầu chóng mặt nên khám chuyên khoa nào", 4);
  assert.ok(qa.passages.length > 0, "RAG phai tra ve doan thong tin");
  console.log(
    `[ok] medical_qa mode=${qa.mode}, ${qa.passages.length} passages, top="${qa.passages[0].title}"`,
  );

  console.log("\nTAT CA KIEM CHUNG DAT ✓");
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exit(1);
});
