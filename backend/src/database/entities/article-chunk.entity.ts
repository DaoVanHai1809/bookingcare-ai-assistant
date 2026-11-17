import { Column, Entity, PrimaryColumn } from "typeorm";

/** Tuong ung ban ghi trong data/processed/article-chunks.json (doan bai cam nang cho RAG). */
@Entity("article_chunks")
export class ArticleChunkEntity {
  @PrimaryColumn({ type: "varchar", length: 128 })
  id!: string;

  @Column({ type: "int" })
  articleId!: number;

  @Column({ type: "varchar", length: 1000 })
  title!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  url?: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  page_url?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  category?: string | null;

  @Column({ type: "simple-json" })
  specialties!: { id: number; name: string }[];

  @Column({ type: "int" })
  chunkIndex!: number;

  @Column({ type: "text" })
  text!: string;
}
