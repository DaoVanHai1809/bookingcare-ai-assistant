import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { hasLLMConfig, LLM_MODEL, LLM_PROVIDER, PORT } from "./config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(PORT);
  console.log(`[backend] listening on http://localhost:${PORT}`);
  console.log(
    `[backend] LLM configured: ${hasLLMConfig()} (provider: ${LLM_PROVIDER}, model: ${LLM_MODEL || "(chưa đặt)"})`,
  );
}

void bootstrap();
