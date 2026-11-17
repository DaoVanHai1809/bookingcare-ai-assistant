import { Module } from "@nestjs/common";
import { BookingModule } from "../booking/booking.module";
import { CatalogModule } from "../catalog/catalog.module";
import { LlmModule } from "../llm/llm.module";
import { RagModule } from "../rag/rag.module";
import { AgentService } from "./agent.service";

@Module({
  imports: [CatalogModule, BookingModule, RagModule, LlmModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
