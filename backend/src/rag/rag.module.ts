import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ArticleChunkEntity } from "../database/entities/article-chunk.entity";
import { RagService } from "./rag.service";

@Module({
  imports: [TypeOrmModule.forFeature([ArticleChunkEntity])],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
