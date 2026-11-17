import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { ChatService } from "./chat.service";

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("health")
  async health() {
    return this.chatService.getHealth();
  }

  /**
   * POST /api/chat — SSE stream.
   * Nhan: { sessionId: string, message: string }
   * Tra cac event:
   *   - "token": { text }                    delta van ban cua tro ly
   *   - "cards": { cards: [...] }            du lieu cau truc (bac si/co so/slot/booking/bai viet)
   *   - "error": { message }                 khi co loi (vi du chua cau hinh LLM)
   *   - "done":  { usage: { inputTokens, outputTokens }, latencyMs, sessionId, toolsUsed }
   */
  @Post("api/chat")
  async chat(
    @Body() body: { sessionId?: unknown; message?: unknown },
    @Res() res: Response,
  ): Promise<void> {
    const sessionId =
      typeof body?.sessionId === "string" && body.sessionId
        ? body.sessionId
        : "anonymous";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

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
      const result = await this.chatService.runTurn(sessionId, message, {
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
      this.chatService.appendChatLog({
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
  }
}
