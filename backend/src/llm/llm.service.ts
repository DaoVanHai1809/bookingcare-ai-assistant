import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { Injectable } from "@nestjs/common";
import {
  LLM_MODEL,
  LLM_PROVIDER,
  MAX_OUTPUT_TOKENS,
  llmApiKey,
  type LlmProviderName,
} from "../config";

/**
 * Ngan sach thinking cho Claude (extended thinking) — muc tuong duong
 * "reasoning medium" phia OpenAI. Anthropic yeu cau budget >= 1024 va
 * max_tokens > budget_tokens, nen voi model co thinking: maxTokens =
 * budget + MAX_OUTPUT_TOKENS (phan tra loi hien thi van gioi han 500 token).
 */
const ANTHROPIC_THINKING_BUDGET = 1024;

/**
 * Responses API tinh token suy luan (reasoning) chung vao mot "bo" token
 * dau ra (max_output_tokens). Neu de tran 500 nhu model thuong, co luot
 * model suy luan dai se an het tran truoc khi kip goi tool hay viet cau tra
 * loi -> phan hoi rong. Cong them khoang dem cho reasoning (tuong tu cach
 * lam phia Anthropic); tran cho phan tra loi hien thi van la
 * MAX_OUTPUT_TOKENS va output trung binh do duoc van duoi 500 token/luot.
 */
const OPENAI_REASONING_HEADROOM = 1024;

/** Cac dong Claude ho tro extended thinking (3.7 va the he 4 tro di). */
function anthropicSupportsThinking(model: string): boolean {
  return /claude-3-7|claude-(sonnet|opus|haiku)-4/i.test(model);
}

/**
 * Factory tao chat model theo nha cung cap (Strategy/Factory):
 * - LLM_PROVIDER=openai    -> ChatOpenAI (@langchain/openai),
 *   reasoning_effort=medium cho dong gpt-5/o-series.
 * - LLM_PROVIDER=anthropic -> ChatAnthropic (@langchain/anthropic),
 *   extended thinking muc tuong duong medium cho dong Claude ho tro.
 * Model tuy y qua LLM_MODEL; doi provider/model chi bang bien moi truong.
 */
@Injectable()
export class LlmService {
  readonly provider: LlmProviderName = LLM_PROVIDER;
  readonly model: string = LLM_MODEL;

  createChatModel(): BaseChatModel {
    if (LLM_PROVIDER === "anthropic") {
      const thinking = anthropicSupportsThinking(LLM_MODEL);
      return new ChatAnthropic({
        model: LLM_MODEL,
        apiKey: llmApiKey(),
        maxTokens: thinking
          ? ANTHROPIC_THINKING_BUDGET + MAX_OUTPUT_TOKENS
          : MAX_OUTPUT_TOKENS,
        ...(thinking
          ? {
              thinking: {
                type: "enabled" as const,
                budget_tokens: ANTHROPIC_THINKING_BUDGET,
              },
            }
          : {}),
      });
    }
    const isReasoning = /gpt-5|o[1-9]/i.test(LLM_MODEL);
    return new ChatOpenAI({
      model: LLM_MODEL,
      apiKey: llmApiKey(),
      maxTokens: isReasoning
        ? MAX_OUTPUT_TOKENS + OPENAI_REASONING_HEADROOM
        : MAX_OUTPUT_TOKENS,
      ...(isReasoning
        ? {
            // gpt-5/o-series tren Chat Completions khong cho dung function
            // tools kem reasoning_effort (API tra 400) — phai qua Responses
            // API moi giu duoc ca tools lan reasoning muc medium.
            useResponsesApi: true,
            reasoning: { effort: "medium" as const },
          }
        : { temperature: 0.2 }),
    });
  }
}
