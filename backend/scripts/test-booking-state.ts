/**
 * Kiem chung may trang thai dat lich o backend (KHONG can LLM):
 * - check_slots ghim bac si vao session_booking_states.
 * - check_slots bac si khac ghi de pin (nguoi dung doi bac si).
 * - create_booking voi slot lech bac si da ghim bi guardrail chan,
 *   khong tao booking.
 * - create_booking voi slot dung bac si da ghim thanh cong,
 *   trang thai chuyen sang "booked".
 * Chay: npx tsx scripts/test-booking-state.ts
 * Booking va state row tao ra trong test duoc don sach o cuoi script.
 */
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { createTools } from "../src/agent/tools";
import { AppModule } from "../src/app.module";
import { BookingStateService } from "../src/booking/booking-state.service";
import { BookingService } from "../src/booking/booking.service";
import { CatalogService } from "../src/catalog/catalog.service";
import { BookingEntity } from "../src/database/entities/booking.entity";
import { SessionBookingStateEntity } from "../src/database/entities/session-booking-state.entity";
import { SlotEntity } from "../src/database/entities/slot.entity";
import { RagService } from "../src/rag/rag.service";

const SESSION_ID = "test-state-1";
const PHONE = "0900000001";

let failures = 0;
function check(label: string, cond: boolean, extra = ""): void {
  if (cond) {
    console.log(`[PASS] ${label}`);
  } else {
    failures += 1;
    console.log(`[FAIL] ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

function outText(res: unknown): string {
  if (typeof res === "string") return res;
  const c = (res as { content?: unknown } | null)?.content;
  return typeof c === "string" ? c : JSON.stringify(res);
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const catalog = app.get(CatalogService);
    const booking = app.get(BookingService);
    const rag = app.get(RagService);
    const state = app.get(BookingStateService);
    const ds = app.get(DataSource);
    const slotRepo = ds.getRepository(SlotEntity);
    const bookingRepo = ds.getRepository(BookingEntity);

    const tools = createTools({ catalog, booking, rag, state });
    const checkSlots = tools.find((t) => t.name === "check_slots");
    const createBooking = tools.find((t) => t.name === "create_booking");
    if (!checkSlots || !createBooking) {
      throw new Error("Khong tim thay tool check_slots/create_booking");
    }
    const cfg = { configurable: { sessionId: SESSION_ID } };

    // Don trang thai cu neu co (idempotent khi chay lai)
    await state.clear(SESSION_ID);
    await bookingRepo.delete({ phone: PHONE });

    // Chon 2 bac si A, B deu co slot trong du lieu seed
    const slotA = await slotRepo.findOne({ where: { status: "available" } });
    if (!slotA) throw new Error("Khong co slot nao trong DB");
    const slotB = await slotRepo
      .find({ where: { status: "available" }, take: 500 })
      .then((rows) => rows.find((s) => s.doctorId !== slotA.doctorId) ?? null);
    if (!slotB) throw new Error("Khong tim thay bac si thu hai co slot");
    const doctorA = slotA.doctorId;
    const doctorB = slotB.doctorId;
    console.log(`[data] doctorA=${doctorA} (${slotA.date}) doctorB=${doctorB} (${slotB.date})`);

    // 1. check_slots bac si A -> ghim A
    await checkSlots.invoke({ doctorId: doctorA, date: slotA.date }, cfg);
    let st = await state.get(SESSION_ID);
    check("check_slots A: step = doctor", st?.step === "doctor", `step=${st?.step}`);
    check(
      "check_slots A: doctorId da ghim = A",
      st?.doctorId === doctorA,
      `doctorId=${st?.doctorId}`,
    );

    // 2. check_slots bac si B (cung phien) -> pin ghi de sang B
    await checkSlots.invoke({ doctorId: doctorB, date: slotB.date }, cfg);
    st = await state.get(SESSION_ID);
    check(
      "check_slots B: pin ghi de sang B",
      st?.doctorId === doctorB && st?.step === "doctor",
      `doctorId=${st?.doctorId} step=${st?.step}`,
    );
    check("check_slots B: slot cu bi xoa", st?.slotId == null, `slotId=${st?.slotId}`);

    // 3. create_booking bang slot cua A (lech bac si da ghim B) -> bi chan
    const countBefore = await booking.countBookings();
    const rejected = outText(
      await createBooking.invoke(
        { slotId: slotA.slotId, patientName: "Test State", phone: PHONE },
        cfg,
      ),
    );
    check(
      "guardrail: slot lech bac si bi tu choi",
      rejected.includes("Bác sĩ đã ghim cho phiên này"),
      rejected.slice(0, 200),
    );
    const countAfter = await booking.countBookings();
    check(
      "guardrail: khong tao booking nao",
      countAfter === countBefore,
      `before=${countBefore} after=${countAfter}`,
    );

    // 4. create_booking bang slot con trong cua B -> thanh cong, step=booked
    const bookedRows = await bookingRepo.find({
      where: { status: "confirmed" },
      select: { slotId: true },
    });
    const bookedIds = new Set(bookedRows.map((b) => b.slotId));
    const freeB = await slotRepo
      .find({ where: { doctorId: doctorB, status: "available" }, take: 500 })
      .then((rows) => rows.find((s) => !bookedIds.has(s.slotId)) ?? null);
    if (!freeB) throw new Error("Bac si B khong con slot trong");
    const created = outText(
      await createBooking.invoke(
        { slotId: freeB.slotId, patientName: "Test State", phone: PHONE },
        cfg,
      ),
    );
    check(
      "create_booking dung bac si ghim: thanh cong",
      created.includes("THÀNH CÔNG"),
      created.slice(0, 200),
    );
    st = await state.get(SESSION_ID);
    check("sau dat: step = booked", st?.step === "booked", `step=${st?.step}`);
    check(
      "sau dat: bookingId da ghim",
      !!st?.bookingId,
      `bookingId=${st?.bookingId}`,
    );
    check(
      "sau dat: doctorId van la B (khong bi xoa boi pinSlot/markBooked)",
      st?.doctorId === doctorB,
      `doctorId=${st?.doctorId}`,
    );
    check(
      "sau dat: slotId da ghim dung slot vua dat",
      st?.slotId === freeB.slotId,
      `slotId=${st?.slotId}`,
    );

    // Don dep: xoa booking test + state row
    await bookingRepo.delete({ phone: PHONE });
    await ds
      .getRepository(SessionBookingStateEntity)
      .delete({ sessionId: SESSION_ID });
    console.log("[cleanup] da xoa booking test va state row");

    if (failures > 0) {
      console.log(`\n${failures} assertion THAT BAI ✗`);
      process.exitCode = 1;
    } else {
      console.log("\nTAT CA KIEM CHUNG TRANG THAI DAT ✓");
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exit(1);
});
