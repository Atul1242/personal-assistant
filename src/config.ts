import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => (v ?? "true").toLowerCase() === "true");

const schema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),
  CLAUDE_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),

  ENABLE_GMAIL: bool,
  ENABLE_CALENDAR: bool,
  ENABLE_TELEGRAM: bool,
  ENABLE_WHATSAPP: bool,

  GOOGLE_CREDENTIALS_PATH: z.string().default("./credentials.json"),
  GMAIL_MAX_EMAILS: z.coerce.number().int().positive().default(30),
  CALENDAR_LOOKAHEAD_HOURS: z.coerce.number().positive().default(36),

  TELEGRAM_API_ID: z.coerce.number().int().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_SESSION: z.string().default(""),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_OWNER_CHAT_ID: z.string().optional(),

  DIGEST_SCHEDULE: z.string().default("0 8 * * *,0 13 * * *,0 20 * * *"),
  TIMEZONE: z.string().default("Asia/Kolkata"),
});

// Treat empty strings in .env as "not set"
const env = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""),
);

export const config = schema.parse(env);

export const DATA_DIR = path.resolve("data");
export const paths = {
  googleToken: path.join(DATA_DIR, "google-token.json"),
  whatsappAuth: path.join(DATA_DIR, "whatsapp-auth"),
  whatsappMessages: path.join(DATA_DIR, "whatsapp-messages.json"),
  state: path.join(DATA_DIR, "state.json"),
  digests: path.join(DATA_DIR, "digests"),
};
