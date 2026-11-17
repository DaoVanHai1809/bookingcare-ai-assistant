import fs from "node:fs";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import {
  AgentService,
  type ChatTurnCallbacks,
  type ChatTurnResult,
} from "../agent/agent.service";
import { BookingService } from "../booking/booking.service";
import { CatalogService } from "../catalog/catalog.service";
import {
  hasLLMConfig,
  LLM_API_KEY_ENV,
  LLM_MODEL,
  LLM_PROVIDER,
  LOG_DIR,
} from "../config";
import { RagService } from "../rag/rag.service";

export interface HealthInfo {
  ok: true;
  llmConfigured: boolean;
  /** Nha cung cap + model LLM dang cau hinh (doi bang LLM_PROVIDER/LLM_MODEL). */
  llmProvider: string;
  llmModel: string;
  data: {
    specialties: number;
    doctors: number;
    facilities: number;
    slots: number;
    articles: number;
    bookings: number;
  };
}

/** Dieu phoi phien hoi thoai cho ChatController: validate, goi agent, ghi log. */
@Injectable()
export class ChatService {
  constructor(
    private readonly agent: AgentService,
    private readonly catalog: CatalogService,
    private readonly booking: BookingService,
    private readonly rag: RagService,
  ) {}

  async getHealth(): Promise<HealthInfo> {
    const [catalog, articles, bookings] = await Promise.all([
      this.catalog.counts(),
      this.rag.countChunks(),
      this.booking.countBookings(),
    ]);
    return {
      ok: true,
      llmConfigured: hasLLMConfig(),
      llmProvider: LLM_PROVIDER,
      llmModel: LLM_MODEL,
      data: {
        specialties: catalog.specialties,
        doctors: catalog.doctors,
        facilities: catalog.facilities,
        slots: catalog.slots,
        articles,
        bookings,
      },
    };
  }

  async runTurn(
    sessionId: string,
    message: string,
    cb: ChatTurnCallbacks,
  ): Promise<ChatTurnResult> {
    if (!message) throw new Error("Thiếu nội dung tin nhắn (message).");
    if (!hasLLMConfig()) {
      throw new Error(
        `Trợ lý AI chưa được cấu hình: thiếu ${LLM_API_KEY_ENV} hoặc LLM_MODEL trong .env (provider đang chọn: ${LLM_PROVIDER}).`,
      );
    }
    return this.agent.runChatTurn(sessionId, message, cb);
  }

  appendChatLog(entry: Record<string, unknown>): void {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.appendFileSync(
        path.join(LOG_DIR, "chat.jsonl"),
        JSON.stringify(entry) + "\n",
        "utf8",
      );
    } catch {
      // Log loi thi bo qua, khong lam hong luot chat
    }
  }
}
