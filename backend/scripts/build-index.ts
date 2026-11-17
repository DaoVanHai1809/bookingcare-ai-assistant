/**
 * Lap chi muc embedding cho tap tai lieu RAG (data/processed/rag-documents.json)
 * bang OpenAI text-embedding-3-small, luu ra data/processed/vector-index.json.
 *
 * Chay: npm run data:index   (can chay `npm run data:prepare` truoc)
 * Neu chua co OPENAI_API_KEY: bao ro va thoat em (exit 0) — he thong van chay
 * duoc bang che do tim tu khoa du phong trong luc cho doi key.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { OpenAIEmbeddings } from "@langchain/openai";
import { DATA_PROCESSED_DIR, EMBEDDING_MODEL } from "../src/config";
import type { RagDocument, VectorIndexFile } from "../src/data/types";

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[build-index] CHUA CO OPENAI_API_KEY trong moi truong (.env) — bo qua lap chi muc embedding.\n" +
        "[build-index] He thong se dung che do tim kiem tu khoa du phong cho medical_qa.\n" +
        "[build-index] Sau khi co key, chay lai: npm run data:index",
    );
    process.exit(0);
  }

  const docsPath = path.join(DATA_PROCESSED_DIR, "rag-documents.json");
  if (!fs.existsSync(docsPath)) {
    console.error("[build-index] Chua co rag-documents.json — hay chay `npm run data:prepare` truoc.");
    process.exit(1);
  }
  const docs = JSON.parse(fs.readFileSync(docsPath, "utf8")) as RagDocument[];
  console.log(`[build-index] Dang embedding ${docs.length} tai lieu bang ${EMBEDDING_MODEL}...`);

  const embeddings = new OpenAIEmbeddings({ model: EMBEDDING_MODEL, apiKey });
  const vectors = await embeddings.embedDocuments(docs.map((d) => d.text));

  const index: VectorIndexFile = {
    model: EMBEDDING_MODEL,
    createdAt: new Date().toISOString(),
    docs: docs.map((d, i) => ({ ...d, embedding: vectors[i] })),
  };
  const out = path.join(DATA_PROCESSED_DIR, "vector-index.json");
  fs.writeFileSync(out, JSON.stringify(index), "utf8");
  console.log(
    `[build-index] Xong: ${index.docs.length} vectors, chieu=${vectors[0]?.length ?? 0}, file=${out}`,
  );
}

main().catch((err) => {
  console.error("[build-index] Loi:", err instanceof Error ? err.message : err);
  process.exit(1);
});
