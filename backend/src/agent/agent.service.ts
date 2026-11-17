import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { Injectable } from "@nestjs/common";
import { createAgent } from "langchain";
import { BookingService } from "../booking/booking.service";
import { CatalogService } from "../catalog/catalog.service";
import type { Card } from "../common/cards";
import { MAX_TOOL_ROUNDS } from "../config";
import { LlmService } from "../llm/llm.service";
import { RagService } from "../rag/rag.service";
import { createTools } from "./tools";

const BASE_SYSTEM_PROMPT = `Bạn là trợ lý AI của BookingCare, hỗ trợ người dùng Việt Nam tìm kiếm thông tin, hỏi đáp và đặt lịch khám với bác sĩ/cơ sở y tế. Hôm nay là {today}.

QUY TẮC BẮT BUỘC:
1. Chỉ dùng dữ kiện lấy từ các công cụ (tools) để nói về bác sĩ, cơ sở, giá khám, lịch khám. TUYỆT ĐỐI không tự bịa tên bác sĩ, giá, địa chỉ hay khung giờ.
2. Không chẩn đoán bệnh, không kê đơn thuốc, không kết luận tình trạng sức khỏe của người dùng. Thông tin y khoa chỉ ở mức tham khảo và nên khuyên đi khám khi cần.
3. Nếu người dùng mô tả dấu hiệu nguy hiểm (đau ngực dữ dội, khó thở, ngất, chảy máu nhiều, đột quỵ, sốt cao co giật ở trẻ em...), hãy khuyên gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất NGAY, trước mọi nội dung khác.
4. Luồng đặt lịch: tìm bác sĩ (search_doctors) -> xem giờ trống (check_slots) -> hỏi và xác nhận họ tên + số điện thoại của người khám -> mới gọi create_booking. Không đặt lịch khi chưa có đủ họ tên và số điện thoại.
5. Khi người dùng chưa nói rõ ngày khám, hãy hỏi lại hoặc đề xuất vài ngày gần nhất; ngày luôn dùng định dạng YYYY-MM-DD khi gọi tool.
6. Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, tối đa khoảng 150 từ. Khi liệt kê bác sĩ/giờ khám, trình bày dạng danh sách ngắn kèm giá và nơi khám.
7. Dữ liệu đặt lịch trong hệ thống này là MÔ PHỎNG phục vụ demo trên dữ liệu công khai của BookingCare; nếu người dùng hỏi, hãy nói rõ điều đó.`;

interface Session {
  messages: BaseMessage[];
  summary: string;
}

export interface ChatTurnCallbacks {
  onToken: (text: string) => void;
  onCards: (cards: Card[]) => void;
}

export interface ChatTurnResult {
  reply: string;
  inputTokens: number;
  outputTokens: number;
  toolsUsed: string[];
}

/**
 * Trich text tu mot chunk stream. Chat Completions tra content dang chuoi,
 * con Responses API tra content dang mang cac block ({type:"text", text})
 * kem block reasoning — phai gom dung cac block text, bo qua reasoning.
 */
function chunkText(chunk: {
  content?: unknown;
  text?: string;
} | null | undefined): string {
  if (!chunk) return "";
  const content = chunk.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === "string") return b;
        const block = b as { type?: string; text?: string };
        return block?.type === "text" || block?.type === "output_text"
          ? (block.text ?? "")
          : "";
      })
      .join("");
  }
  return typeof chunk.text === "string" ? chunk.text : "";
}

function estimateTokens(text: string): number {
  // Uoc luong tho: ~3.5 ky tu/token voi tieng Viet
  return Math.ceil(text.length / 3.5);
}

/**
 * Boc logic LangChain agent (createAgent) cua ban Express cu — chuyen
 * nguyen ven: maxTokens 500, toi da 3 vong tool, cat ngan + tom tat lich su
 * de input duoi 30k token, stream token/cards qua callback. Model lay tu
 * LlmService (tru tuong OpenAI/Anthropic theo cau hinh), khong gan cung.
 */
@Injectable()
export class AgentService {
  private readonly sessions = new Map<string, Session>();
  private readonly tools: ReturnType<typeof createTools>;

  constructor(
    catalog: CatalogService,
    booking: BookingService,
    rag: RagService,
    private readonly llm: LlmService,
  ) {
    this.tools = createTools({ catalog, booking, rag });
  }

  private getSession(sessionId: string): Session {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = { messages: [], summary: "" };
      this.sessions.set(sessionId, s);
    }
    return s;
  }

  /**
   * Cat ngan lich su: giu toi da 8 tin gan nhat. Phan cu hon duoc tom tat bang LLM
   * (neu tom tat loi thi cat bo) de input luon duoi nguong 30k token.
   */
  private async trimHistory(session: Session, model: BaseChatModel): Promise<void> {
    const KEEP = 8;
    if (session.messages.length <= KEEP) return;
    const overflow = session.messages.slice(0, session.messages.length - KEEP);
    const kept = session.messages.slice(session.messages.length - KEEP);
    try {
      const text = overflow
        .map((m) => `${m.getType() === "human" ? "Người dùng" : "Trợ lý"}: ${String(m.content)}`)
        .join("\n")
        .slice(0, 8000);
      const res = await model.invoke([
        new HumanMessage(
          `Tóm tắt ngắn gọn (tối đa 120 từ, tiếng Việt) các ý chính cần nhớ của đoạn hội thoại sau, gồm cả tóm tắt trước đó nếu có.\nTóm tắt trước đó: ${session.summary || "(chưa có)"}\nĐoạn hội thoại:\n${text}`,
        ),
      ]);
      session.summary = String(res.content).slice(0, 1500);
    } catch {
      session.summary = session.summary || "";
    }
    session.messages = kept;
  }

  /** Chay mot luot hoi thoai: stream token + cards qua callback, tra usage. */
  async runChatTurn(
    sessionId: string,
    message: string,
    cb: ChatTurnCallbacks,
  ): Promise<ChatTurnResult> {
    const session = this.getSession(sessionId);
    const model = this.llm.createChatModel();
    await this.trimHistory(session, model);

    const today = new Date().toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    let systemPrompt = BASE_SYSTEM_PROMPT.replace("{today}", today);
    if (session.summary) {
      systemPrompt += `\n\nTóm tắt hội thoại trước đó với người dùng này: ${session.summary}`;
    }

    const agent = createAgent({
      model,
      tools: this.tools,
      systemPrompt,
    });

    const inputMessages: BaseMessage[] = [
      ...session.messages,
      new HumanMessage(message),
    ];

    let reply = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const toolsUsed: string[] = [];
    let toolStarts = 0;

    const stream = agent.streamEvents(
      { messages: inputMessages },
      { version: "v2", recursionLimit: MAX_TOOL_ROUNDS * 4 + 4 },
    );

    for await (const event of stream) {
      if (event.event === "on_chat_model_stream") {
        const chunk = event.data?.chunk;
        const text = chunkText(chunk);
        if (text) {
          reply += text;
          cb.onToken(text);
        }
      } else if (event.event === "on_chat_model_end") {
        const usage = event.data?.output?.usage_metadata;
        if (usage) {
          inputTokens += usage.input_tokens ?? 0;
          outputTokens += usage.output_tokens ?? 0;
        }
      } else if (event.event === "on_tool_start") {
        toolStarts += 1;
        if (event.name) toolsUsed.push(event.name);
        // Gioi han toi da ~3 vong goi tool: moi vong toi da 2 tool song song
        if (toolStarts > MAX_TOOL_ROUNDS * 2) break;
      } else if (event.event === "on_tool_end") {
        const raw = event.data?.output?.content;
        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw) as { cards?: Card[] };
            if (Array.isArray(parsed.cards) && parsed.cards.length) {
              cb.onCards(parsed.cards);
            }
          } catch {
            // Tool tra text thuong (khong phai JSON) -> khong co cards
          }
        }
      }
    }

    // Du phong: API khong tra usage_metadata -> uoc luong tu ky tu
    if (inputTokens === 0) {
      inputTokens = estimateTokens(
        inputMessages.map((m) => String(m.content)).join("\n"),
      );
    }
    if (outputTokens === 0 && reply) outputTokens = estimateTokens(reply);

    session.messages.push(new HumanMessage(message), new AIMessage(reply));
    return { reply, inputTokens, outputTokens, toolsUsed };
  }
}
