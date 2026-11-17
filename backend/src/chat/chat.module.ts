import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { BookingModule } from "../booking/booking.module";
import { CatalogModule } from "../catalog/catalog.module";
import { RagModule } from "../rag/rag.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [AgentModule, CatalogModule, BookingModule, RagModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
