import fs from "node:fs";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { Card } from "../common/cards";
import { DATA_PROCESSED_DIR } from "../config";
import type { RagDocument } from "../data/types";
import { ArticleChunkEntity } from "../database/entities/article-chunk.entity";
import { ragSearch } from "./vectorStore";

export interface QaResult {
  passages: { title: string; url?: string; type: string; text: string; score: number }[];
  cards: Card[];
  mode: "vector" | "lexical";
}

/**
 * Hoi dap y khoa bang RAG. Vector store giu dang file
 * (data/processed/vector-index.json + rag-documents.json) nhu thiet ke goc;
 * so doan bai viet (cho /health) dem qua repository.
 */
@Injectable()
export class RagService {
  private ragDocsCache: RagDocument[] | null = null;

  constructor(
    @InjectRepository(ArticleChunkEntity)
    private readonly chunkRepo: Repository<ArticleChunkEntity>,
  ) {}

  async countChunks(): Promise<number> {
    return this.chunkRepo.count();
  }

  private ragDocs(): RagDocument[] {
    if (this.ragDocsCache) return this.ragDocsCache;
    const p = path.join(DATA_PROCESSED_DIR, "rag-documents.json");
    this.ragDocsCache = fs.existsSync(p)
      ? (JSON.parse(fs.readFileSync(p, "utf8")) as RagDocument[])
      : [];
    return this.ragDocsCache;
  }

  /** Hoi dap y khoa bang RAG: truy xuat top-k=4 doan lien quan nhat. */
  async medicalQa(query: string, k = 4): Promise<QaResult> {
    const { hits, mode } = await ragSearch(this.ragDocs(), query, k);
    const passages = hits.map((h) => ({
      title: h.doc.title,
      url: h.doc.url,
      type: h.doc.type,
      text: h.doc.text.slice(0, 700),
      score: Number(h.score.toFixed(3)),
    }));
    const cards: Card[] = hits
      .filter((h) => h.doc.type === "article")
      .map((h) => ({
        type: "article",
        title: h.doc.title,
        url: h.doc.url,
        snippet: h.doc.text.slice(0, 200),
      }));
    return { passages, cards, mode };
  }
}
