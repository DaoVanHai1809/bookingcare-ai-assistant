import path from "node:path";

// backend/src khi chay bang tsx, backend/dist khi chay ban build — ca hai deu
// nam ngay duoi thu muc backend nen resolve("..") cho ra BACKEND_ROOT dung.
const here = __dirname;

export const BACKEND_ROOT = path.resolve(here, "..");
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, "..");
export const DATA_RAW_DIR = path.join(PROJECT_ROOT, "data", "raw");
export const DATA_PROCESSED_DIR = path.join(PROJECT_ROOT, "data", "processed");
export const LOG_DIR = path.join(BACKEND_ROOT, "logs");

export const PORT = Number(process.env.PORT ?? 3001);

/**
 * Cau hinh LLM — tru tuong hoa nha cung cap (Strategy/Factory o LlmModule):
 * - LLM_PROVIDER=openai|anthropic (mac dinh openai)
 * - LLM_MODEL=<ten model tuy y cua provider do> (fallback: OPENAI_MODEL cu)
 * - API key doc theo provider: OPENAI_API_KEY hoac ANTHROPIC_API_KEY.
 * Thieu key cua provider dang chon hoac thieu model => /api/chat tra loi loi cau hinh.
 */
export type LlmProviderName = "openai" | "anthropic";

export const LLM_PROVIDER: LlmProviderName =
  (process.env.LLM_PROVIDER ?? "openai").toLowerCase() === "anthropic"
    ? "anthropic"
    : "openai";
export const LLM_MODEL =
  process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
/** Ten bien moi truong chua API key cua provider — dung trong thong bao loi. */
export const LLM_API_KEY_ENV =
  LLM_PROVIDER === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";

export const llmApiKey = (): string =>
  LLM_PROVIDER === "anthropic"
    ? process.env.ANTHROPIC_API_KEY ?? ""
    : process.env.OPENAI_API_KEY ?? "";

export const hasLLMConfig = (): boolean => Boolean(llmApiKey() && LLM_MODEL);

export const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Tang du lieu TypeORM.
 * - Mac dinh: SQLite (file backend/bookingcare.db) — khong can cai DB server.
 * - DB_TYPE=mysql: dung MySQL, cau hinh qua DB_HOST/DB_PORT/DB_USERNAME/
 *   DB_PASSWORD/DB_DATABASE. Chi can doi bien moi truong, khong doi code.
 */
export const DB_TYPE = (process.env.DB_TYPE ?? "sqlite").toLowerCase();
export const SQLITE_PATH =
  process.env.DB_SQLITE_PATH ?? path.join(BACKEND_ROOT, "bookingcare.db");
export const DB_HOST = process.env.DB_HOST ?? "localhost";
export const DB_PORT = Number(process.env.DB_PORT ?? 3306);
export const DB_USERNAME = process.env.DB_USERNAME ?? "root";
export const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
export const DB_DATABASE = process.env.DB_DATABASE ?? "bookingcare_ai";

/** Gioi han theo de bai Cau 3. */
export const MAX_OUTPUT_TOKENS = 500;
export const MAX_INPUT_TOKENS = 30_000;
export const MAX_TOOL_ROUNDS = 3;
