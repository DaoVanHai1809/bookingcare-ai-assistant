import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service";

/**
 * Lop tru tuong nha cung cap LLM: cac tang tren (AgentService, RAG) chi
 * nhan BaseChatModel tu LlmService, khong phu thuoc cung vao OpenAI hay
 * Anthropic. Doi nha cung cap bang LLM_PROVIDER + LLM_MODEL + key tuong ung.
 */
@Module({
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
