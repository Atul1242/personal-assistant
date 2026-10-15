import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => (v ?? "true").toLowerCase() === "true");

const schema = z.object({
  OLLAMA_HOST: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:7b"),
  OLLAMA_NUM_CTX: z.coerce.number().int().positive().default(8192),

  ENABLE_GMAIL: bool,
  ENABLE_CALENDAR: bool,
  ENABLE_TELEGRAM: bool,
  ENABLE_WHATSAPP: bool,
  WHATSAPP_POLL_SECONDS: z.coerce.number().positive().default(15),

  GOOGLE_CREDENTIALS_PATH: z.string().default("./credentials.json"),
  GMAIL_MAX_EMAILS: z.coerce.number().int().positive().default(30),
  CALENDAR_LOOKAHEAD_HOURS: z.coerce.number().positive().default(36),

  TELEGRAM_API_ID: z.coerce.number().int().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_SESSION: z.string().default(""),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_OWNER_CHAT_ID: z.string().optional(),

  DIGEST_SCHEDULE: z.string().default(""),
  TIMEZONE: z.string().default("Asia/Kolkata"),
  USER_NAME: z.string().default(""),
});

// Treat empty strings in .env as "not set"
const env = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""),
);

export const config = schema.parse(env);

export const DATA_DIR = path.resolve("data");
export const paths = {
  googleToken: path.join(DATA_DIR, "google-token.json"),
  whatsappMessages: path.join(DATA_DIR, "whatsapp-messages.json"),
  state: path.join(DATA_DIR, "state.json"),
  digests: path.join(DATA_DIR, "digests"),
};
