import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { LOG_DIR, PORT, hasLLMConfig } from "./config";
import { getStore } from "./data/store";
import { runChatTurn } from "./agent";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  const store = getStore();
  res.json({
    ok: true,
    llmConfigured: hasLLMConfig(),
    data: {
      specialties: store.specialties.length,
      doctors: store.doctors.length,
      facilities: store.facilities.length,
      slots: store.slots.length,
      articles: store.chunks.length,
      bookings: store.bookings.length,
    },
  });
});

function appendChatLog(entry: Record<string, unknown>): void {
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

/**
 * POST /api/chat — SSE stream.
 * Nhan: { sessionId: string, message: string }
 * Tra cac event:
 *   - "token": { text }                    delta van ban cua tro ly
 *   - "cards": { cards: [...] }            du lieu cau truc (bac si/co so/slot/booking/bai viet)
 *   - "error": { message }                 khi co loi (vi du chua cau hinh LLM)
 *   - "done":  { usage: { inputTokens, outputTokens }, latencyMs, sessionId }
 */
app.post("/api/chat", async (req, res) => {
  const body = (req.body ?? {}) as { sessionId?: unknown; message?: unknown };
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId ? body.sessionId : "anonymous";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const startedAt = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let toolsUsed: string[] = [];
  let errorMessage: string | null = null;

  try {
    if (!message) throw new Error("Thiếu nội dung tin nhắn (message).");
    if (!hasLLMConfig()) {
      throw new Error(
        "Trợ lý AI chưa được cấu hình: thiếu OPENAI_API_KEY hoặc OPENAI_MODEL trong .env.",
      );
    }
    const result = await runChatTurn(sessionId, message, {
      onToken: (text) => send("token", { text }),
      onCards: (cards) => send("cards", { cards }),
    });
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    toolsUsed = result.toolsUsed;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    send("error", { message: errorMessage });
  } finally {
    const latencyMs = Date.now() - startedAt;
    send("done", {
      usage: { inputTokens, outputTokens },
      latencyMs,
      sessionId,
      toolsUsed,
    });
    appendChatLog({
      ts: new Date().toISOString(),
      sessionId,
      message: message.slice(0, 300),
      latencyMs,
      inputTokens,
      outputTokens,
      toolsUsed,
      error: errorMessage,
    });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(
    `[backend] LLM configured: ${hasLLMConfig()} (model: ${process.env.OPENAI_MODEL || "(chưa đặt)"})`,
  );
});
