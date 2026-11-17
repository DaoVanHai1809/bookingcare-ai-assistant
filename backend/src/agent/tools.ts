import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { BookingService } from "../booking/booking.service";
import type { CatalogService } from "../catalog/catalog.service";
import { formatPrice, type Card } from "../common/cards";
import type { RagService } from "../rag/rag.service";

export interface ToolDeps {
  catalog: CatalogService;
  booking: BookingService;
  rag: RagService;
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
    async ({ specialty, province, date, limit }) => {
      const { doctors, cards } = await deps.catalog.searchDoctors({
        specialty,
        province,
        date,
        limit,
      });
      if (!doctors.length) {
        return pack(
          "Không tìm thấy bác sĩ phù hợp với tiêu chí. Hãy gợi ý người dùng đổi chuyên khoa, tỉnh/thành hoặc ngày khám.",
          [],
        );
      }
      const lines = doctors.map((d, i) => {
        const price = cards[i] as unknown as { priceLabel: string };
        const facs = (d.schedule ?? [])
          .map((s) => s.facility_name)
          .filter((v, idx, a) => a.indexOf(v) === idx)
          .join("; ");
        return `- doctorId=${d.id} | ${d.name} | Chuyên khoa: ${d.specialties
          .map((s) => s.name)
          .join(", ")} | ${d.province ?? ""} | Giá: ${price.priceLabel} | Nơi khám: ${facs} | ${
          d.summary?.slice(0, 160) ?? ""
        }`;
      });
      return pack(
        `Tìm thấy ${doctors.length} bác sĩ:\n${lines.join("\n")}\nDùng check_slots với doctorId và ngày (YYYY-MM-DD) để xem giờ trống.`,
        cards,
      );
    },
    {
      name: "search_doctors",
      description:
        "Tìm bác sĩ theo chuyên khoa (tiếng Việt, ví dụ 'Cơ Xương Khớp'), tỉnh/thành (ví dụ 'Hà Nội') và/hoặc ngày khám (YYYY-MM-DD). Trả về danh sách bác sĩ kèm doctorId, giá khám, nơi khám.",
      schema: z.object({
        specialty: z.string().optional().describe("Tên chuyên khoa, ví dụ: Cơ Xương Khớp"),
        province: z.string().optional().describe("Tỉnh/thành, ví dụ: Hà Nội"),
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
    async ({ doctorId, date }) => {
      const result = await deps.booking.checkSlots(doctorId, date);
      if ("error" in result) return pack(result.error, []);
      const avail = result.slots.filter((s) => s.status === "available");
      const lines = result.slots.map(
        (s) =>
          `- slotId=${s.slotId} | ${s.label} | ${s.facilityName} | Giá: ${formatPrice(
            s.priceMin,
            s.priceMax,
          )} | ${s.status === "available" ? "CÒN TRỐNG" : "HẾT CHỖ"}`,
      );
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
    async ({ slotId, patientName, phone, idempotencyKey }) => {
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
