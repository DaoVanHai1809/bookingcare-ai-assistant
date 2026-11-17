import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Khung endpoint chat — logic AI (LangChain agent + tools search/RAG/booking)
// se duoc bo sung o buoc sau. Hien tai tra placeholder de frontend/eval noi vao.
app.post("/api/chat", (req, res) => {
  const { message, sessionId } = (req.body ?? {}) as {
    message?: unknown;
    sessionId?: unknown;
  };

  res.json({
    reply:
      "Xin chao! Backend khung dang chay — logic tro ly AI se duoc bo sung o buoc tiep theo.",
    echo: typeof message === "string" ? message : null,
    sessionId: typeof sessionId === "string" ? sessionId : null,
    usage: { inputTokens: 0, outputTokens: 0 },
  });
});

app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
