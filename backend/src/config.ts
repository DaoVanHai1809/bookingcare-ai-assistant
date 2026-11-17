import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)); // backend/src

export const BACKEND_ROOT = path.resolve(here, "..");
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, "..");
export const DATA_RAW_DIR = path.join(PROJECT_ROOT, "data", "raw");
export const DATA_PROCESSED_DIR = path.join(PROJECT_ROOT, "data", "processed");
export const LOG_DIR = path.join(BACKEND_ROOT, "logs");

export const PORT = Number(process.env.PORT ?? 3001);

/** API key + model cho LLM. Thiếu một trong hai => /api/chat tra loi loi cau hinh. */
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "";
export const hasLLMConfig = (): boolean =>
  Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);

export const EMBEDDING_MODEL = "text-embedding-3-small";

/** Gioi han theo de bai Cau 3. */
export const MAX_OUTPUT_TOKENS = 500;
export const MAX_INPUT_TOKENS = 30_000;
export const MAX_TOOL_ROUNDS = 3;
