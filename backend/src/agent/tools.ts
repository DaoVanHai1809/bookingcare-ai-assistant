import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { BookingStateService } from "../booking/booking-state.service";
import type { BookingService } from "../booking/booking.service";
import type { CatalogService } from "../catalog/catalog.service";
import { formatPrice, type Card } from "../common/cards";
import type { RagService } from "../rag/rag.service";

export interface ToolDeps {
  catalog: CatalogService;
  booking: BookingService;
  rag: RagService;
  state: BookingStateService;
}

/**
 * sessionId duoc truyen qua LangChain runnable config (configurable.sessionId)
 * tu AgentService. Khi chay tool ngoai luong chat (test) thi khong co ->
 * bo qua moi thao tac trang thai.
 */
function sessionIdOf(config: unknown): string | undefined {
  const sid = (config as { configurable?: { sessionId?: unknown } } | undefined)
    ?.configurable?.sessionId;
  return typeof sid === "string" && sid ? sid : undefined;
}

/**
 * Moi tool tra ve chuoi JSON gom:
 *  - summary: tom tat ngan bang text de LLM dua vao tra loi (kem cac ma dinh danh
 *    nhu doctorId, slotId de LLM co the goi tool tiep theo chinh xac).
 *  - cards: du lieu cau truc de backend trich ra gui cho frontend (SSE "cards").
 */
function pack(summary: string, cards: Card[]): string {
  return JSON.stringify({ summary, cards });
}

export function createTools(deps: ToolDeps) {
  const searchDoctorsTool = tool(
    async ({ specialty, province, name, date, limit }) => {
      const { doctors, cards, dateAvailability } = await deps.catalog.searchDoctors({
        specialty,
        province,
        name,
        date,
        limit: limit ?? 5,
      });
      if (!doctors.length) {
        return pack(
          "Không tìm thấy bác sĩ phù hợp với tiêu chí. Hãy gợi ý người dùng đổi chuyên khoa hoặc tỉnh/thành.",
          [],
        );
      }
      const lines = doctors.map((d, i) => {
        const price = cards[i] as unknown as { priceLabel: string };
        const facs = (d.schedule ?? [])
          .map((s) => s.facility_name)
          .filter((v, idx, a) => a.indexOf(v) === idx)
          .join("; ");
        let line = `- doctorId=${d.id} | ${d.name} | Chuyên khoa: ${d.specialties
          .map((s) => s.name)
          .join(", ")} | ${d.province ?? ""} | Giá: ${price.priceLabel} | Nơi khám: ${facs}`;
        // Khi nguoi dung hoi theo ngay: noi ro bac si co lich ngay do hay
        // khong, kem ngay co lich gan nhat — agent khong duoc "khong tim
        // thay" hay hoi lai khi bac si chi la khong kham ngay do.
        if (date && dateAvailability) {
          const info = dateAvailability[String(d.id)];
          if (info) {
            line +=
              info.availableOnDate > 0
                ? ` | Ngày ${date}: còn ${info.availableOnDate} khung trống`
                : ` | Ngày ${date}: KHÔNG có lịch | Ngày có lịch gần nhất: ${
                    info.nearestDates.join(", ") || "không có trong dữ liệu lịch hiện có"
                  }`;
          }
        }
        return line;
      });
      let footer = `\nDùng check_slots với doctorId và ngày (YYYY-MM-DD) để xem giờ trống.`;
      if (
        date &&
        dateAvailability &&
        doctors.every((d) => (dateAvailability[String(d.id)]?.availableOnDate ?? 0) === 0)
      ) {
        footer = `\nKhông bác sĩ nào ở trên có lịch ngày ${date}. Hãy nói rõ điều này với người dùng, gợi ý các ngày có lịch gần nhất đã ghi ở trên và hỏi họ có muốn xem lịch ngày đó không — KHÔNG hỏi lại chuyên khoa/tỉnh thành đã biết.`;
      }
      return pack(
        `Tìm thấy ${doctors.length} bác sĩ:\n${lines.join("\n")}${footer}`,
        cards,
      );
    },
    {
      name: "search_doctors",
      description:
        "Tìm bác sĩ theo tên cụ thể (khi người dùng nêu tên bác sĩ), chuyên khoa (tiếng Việt, ví dụ 'Cơ Xương Khớp'), tỉnh/thành (ví dụ 'Hà Nội') và/hoặc ngày khám (YYYY-MM-DD). Trả về danh sách bác sĩ kèm doctorId, giá khám, nơi khám; khi có ngày, mỗi bác sĩ kèm trạng thái có lịch ngày đó và các ngày có lịch gần nhất.",
      schema: z.object({
        specialty: z.string().optional().describe("Tên chuyên khoa, ví dụ: Cơ Xương Khớp"),
        province: z.string().optional().describe("Tỉnh/thành, ví dụ: Hà Nội"),
        name: z
          .string()
          .optional()
          .describe("Tên bác sĩ cụ thể khi người dùng nêu tên, ví dụ: Vũ Văn Hòe"),
        date: z
          .string()
          .optional()
          .describe("Ngày khám dạng YYYY-MM-DD, chỉ dùng khi người dùng nêu ngày cụ thể"),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
  );

  const searchFacilitiesTool = tool(
    async ({ keyword, province, limit }) => {
      const { cards, count } = await deps.catalog.searchFacilities({
        keyword,
        province,
        limit,
      });
      if (!count) return pack("Không tìm thấy cơ sở y tế phù hợp.", []);
      const lines = cards.map(
        (c) =>
          `- facilityId=${c.facilityId} | ${c.name} | ${String(c.address ?? "").slice(0, 120)}`,
      );
      return pack(`Tìm thấy ${count} cơ sở y tế:\n${lines.join("\n")}`, cards);
    },
    {
      name: "search_facilities",
      description:
        "Tìm cơ sở y tế (bệnh viện/phòng khám) theo từ khóa tên/địa chỉ và/hoặc tỉnh/thành.",
      schema: z.object({
        keyword: z.string().optional().describe("Từ khóa tên cơ sở hoặc địa chỉ"),
        province: z.string().optional().describe("Tỉnh/thành, ví dụ: Hà Nội"),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    },
  );

  const medicalQaTool = tool(
    async ({ query }) => {
      const { passages, cards, mode } = await deps.rag.medicalQa(query, 4);
      if (!passages.length) {
        return pack(
          "Không tìm thấy thông tin liên quan trong dữ liệu cẩm nang. Hãy trả lời thận trọng, không bịa, và gợi ý người dùng đi khám để được tư vấn trực tiếp.",
          [],
        );
      }
      const lines = passages.map(
        (p, i) => `[${i + 1}] (${p.type}) ${p.title}${p.url ? ` — ${p.url}` : ""}\n${p.text}`,
      );
      return pack(
        `Các đoạn thông tin truy xuất được (chế độ ${mode}). Chỉ trả lời dựa trên các đoạn này và ghi rõ đây là thông tin tham khảo, không phải chẩn đoán:\n${lines.join("\n\n")}`,
        cards,
      );
    },
    {
      name: "medical_qa",
      description:
        "Hỏi đáp thông tin y khoa/sức khỏe (triệu chứng thường gặp, chuẩn bị đi khám, kiến thức bệnh lý) bằng cách truy xuất dữ liệu cẩm nang BookingCare (RAG). Dùng khi người dùng hỏi kiến thức, KHÔNG dùng để chẩn đoán.",
      schema: z.object({
        query: z.string().describe("Câu hỏi y khoa cần truy xuất thông tin"),
      }),
    },
  );

  const checkSlotsTool = tool(
    async ({ doctorId, date }, config) => {
      const result = await deps.booking.checkSlots(doctorId, date);
      if ("error" in result) return pack(result.error, []);
      // Ghim bac si dang chon vao trang thai phien o backend (may trang thai)
      const sessionId = sessionIdOf(config);
      if (sessionId) {
        await deps.state.pinDoctor(sessionId, {
          doctorId: String(doctorId),
          doctorName: result.doctor.name,
          date,
        });
      }
      const avail = result.slots.filter((s) => s.status === "available");
      const fullCount = result.slots.length - avail.length;
      // Payload gon cho LLM: chi liet ke slot con trong, toi da 12 dong
      // (card gui frontend van giu day du moi slot nhu cu).
      const lines = avail
        .slice(0, 12)
        .map(
          (s) =>
            `- slotId=${s.slotId} | ${s.label} | ${s.facilityName} | Giá: ${formatPrice(
              s.priceMin,
              s.priceMax,
            )} | CÒN TRỐNG`,
        );
      if (avail.length > 12) {
        lines.push(`(+${avail.length - 12} khung giờ còn trống khác)`);
      }
      if (fullCount > 0) {
        lines.push(`(+${fullCount} khung giờ đã hết chỗ)`);
      }
      return pack(
        `Lịch khám của ${result.doctor.name} ngày ${date}: ${avail.length}/${result.slots.length} khung giờ còn trống.\n${lines.join("\n")}\nKhi người dùng chọn giờ và cung cấp họ tên + số điện thoại, dùng create_booking với đúng slotId.`,
        [result.card],
      );
    },
    {
      name: "check_slots",
      description:
        "Xem các khung giờ khám của một bác sĩ trong một ngày cụ thể (YYYY-MM-DD), gồm slotId, giờ, cơ sở, giá và trạng thái còn trống/hết chỗ.",
      schema: z.object({
        doctorId: z.string().describe("Mã bác sĩ lấy từ kết quả search_doctors"),
        date: z.string().describe("Ngày khám dạng YYYY-MM-DD"),
      }),
    },
  );

  const createBookingTool = tool(
    async ({ slotId, patientName, phone, idempotencyKey }, config) => {
      const sessionId = sessionIdOf(config);
      // Guardrail xac dinh: invariant nhat quan bac si nam o BookingStateService,
      // tool chi goi validateSlot va bao loi — chan agent lech du kien giua
      // luong dat lich dai.
      if (sessionId) {
        const v = await deps.state.validateSlot(sessionId, slotId);
        if (!v.ok) {
          return pack(
            `Đặt lịch KHÔNG thành công: slotId thuộc bác sĩ khác. Bác sĩ đã ghim cho phiên này là ${v.doctorName} (doctorId=${v.doctorId}). Chỉ đặt slot của bác sĩ này (dùng check_slots để lấy đúng slotId) hoặc người dùng phải yêu cầu đổi bác sĩ rõ ràng.`,
            [],
          );
        }
      }
      const result = await deps.booking.createBooking({
        slotId,
        patientName,
        phone,
        idempotencyKey,
      });
      if (!result.ok) {
        return pack(`Đặt lịch KHÔNG thành công: ${result.error} (mã ${result.code})`, []);
      }
      const b = result.booking;
      if (sessionId) {
        await deps.state.pinSlot(sessionId, {
          slotId: b.slotId,
          timeLabel: b.timeLabel,
          facilityName: b.facilityName,
        });
        await deps.state.markBooked(sessionId, b.bookingId);
      }
      return pack(
        `Đặt lịch ${result.duplicated ? "đã tồn tại (trùng idempotency key, không tạo mới)" : "THÀNH CÔNG"}: mã ${b.bookingId}, bác sĩ ${b.doctorName}, ${b.facilityName}, ngày ${b.date} lúc ${b.timeLabel}, giá ${formatPrice(b.priceMin, b.priceMax)}, người khám ${b.patientName} (${b.phone}). Đây là đặt lịch mô phỏng trên dữ liệu mẫu.`,
        [result.card],
      );
    },
    {
      name: "create_booking",
      description:
        "Đặt lịch khám (mô phỏng) cho một slotId cụ thể. Chỉ gọi khi người dùng đã chọn khung giờ VÀ đã cung cấp họ tên + số điện thoại. Backend tự kiểm tra trùng slot và idempotency.",
      schema: z.object({
        slotId: z.string().describe("Mã khung giờ lấy từ kết quả check_slots"),
        patientName: z.string().describe("Họ tên người khám"),
        phone: z.string().describe("Số điện thoại liên hệ, 10 số bắt đầu bằng 0"),
        idempotencyKey: z
          .string()
          .optional()
          .describe("Khóa chống trùng lặp; bỏ trống thì backend tự suy từ slotId + số điện thoại"),
      }),
    },
  );

  return [
    searchDoctorsTool,
    searchFacilitiesTool,
    medicalQaTool,
    checkSlotsTool,
    createBookingTool,
  ];
}
