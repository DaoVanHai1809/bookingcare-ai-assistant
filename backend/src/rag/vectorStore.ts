import fs from "node:fs";
import path from "node:path";
import { OpenAIEmbeddings } from "@langchain/openai";
import { DATA_PROCESSED_DIR, EMBEDDING_MODEL } from "../config";
import type { RagDocument, VectorIndexFile } from "../data/types";

export interface RagHit {
  doc: RagDocument;
  score: number;
}

let indexCache: VectorIndexFile | null | undefined;

export function loadVectorIndex(): VectorIndexFile | null {
  if (indexCache !== undefined) return indexCache;
  const p = path.join(DATA_PROCESSED_DIR, "vector-index.json");
  if (!fs.existsSync(p)) {
    indexCache = null;
    return null;
  }
  try {
    indexCache = JSON.parse(fs.readFileSync(p, "utf8")) as VectorIndexFile;
  } catch {
    indexCache = null;
  }
  return indexCache;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Bo dau + thuong hoa de tim kiem tu khoa du phong (khi chua co embedding). */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "la", "va", "cua", "cho", "toi", "bi", "duoc", "khong", "co", "o", "tai",
  "muon", "can", "hay", "thi", "ma", "voi", "khi", "nao", "gi", "ve", "di",
  "kham", "benh", "bac", "si", "bac si", "lam", "sao", "the", "nhu", "mot",
]);

function lexicalSearch(docs: RagDocument[], query: string, k: number): RagHit[] {
  const terms = normalizeText(query)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  if (!terms.length) return [];
  const hits: RagHit[] = [];
  for (const doc of docs) {
    const hay = normalizeText(`${doc.title} ${doc.text}`);
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += 1;
    }
    if (score > 0) hits.push({ doc, score: score / Math.sqrt(terms.length) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Tim kiem ngu nghia top-k tren tap tai lieu RAG.
 * - Co vector-index.json + OPENAI_API_KEY: embedding query + cosine similarity.
 * - Chua co: fallback tim tu khoa tren cung tap tai lieu (van tra top-k).
 */
export async function ragSearch(
  docs: RagDocument[],
  query: string,
  k = 4,
): Promise<{ hits: RagHit[]; mode: "vector" | "lexical" }> {
  const index = loadVectorIndex();
  const apiKey = process.env.OPENAI_API_KEY;
  if (index && apiKey && index.docs.length) {
    try {
      const embeddings = new OpenAIEmbeddings({
        model: index.model || EMBEDDING_MODEL,
        apiKey,
      });
      const q = await embeddings.embedQuery(query);
      const byId = new Map(docs.map((d) => [d.id, d]));
      const hits = index.docs
        .map((d) => ({
          doc: byId.get(d.id) ?? (d as RagDocument),
          score: cosine(q, d.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
      return { hits, mode: "vector" };
    } catch {
      // Loi embedding (key sai/mang...) -> dung fallback tu khoa
      return { hits: lexicalSearch(docs, query, k), mode: "lexical" };
    }
  }
  return { hits: lexicalSearch(docs, query, k), mode: "lexical" };
}
