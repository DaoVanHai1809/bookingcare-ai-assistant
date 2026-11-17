import { Module } from "@nestjs/common";
import { AgentModule } from "./agent/agent.module";
import { BookingModule } from "./booking/booking.module";
import { CatalogModule } from "./catalog/catalog.module";
import { ChatModule } from "./chat/chat.module";
import { DatabaseModule } from "./database/database.module";
import { RagModule } from "./rag/rag.module";

@Module({
  imports: [
    DatabaseModule,
    CatalogModule,
    BookingModule,
    RagModule,
    AgentModule,
    ChatModule,
  ],
})
export class AppModule {}
