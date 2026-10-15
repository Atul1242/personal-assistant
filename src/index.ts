import cron from "node-cron";
import { listenForCommands, type DigestRequest } from "./bot.js";
import { config } from "./config.js";
import { startWhatsAppWatcher } from "./connectors/whatsapp.js";
import { sendViaBot } from "./delivery.js";
import { runDigest } from "./digest.js";

/**
 * On-demand mode: waits for /digest from your Telegram bot and does nothing else.
 * The AI model is only loaded while a digest is being written. Send /stop or press Ctrl+C to quit.
 */

let running = false;

async function digestOnce(req: DigestRequest = {}): Promise<void> {
  if (running) {
    await sendViaBot("Already working on a digest, hang on.").catch(() => {});
    return;
  }
  running = true;
  try {
    await runDigest(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[digest] failed:", msg);
    await sendViaBot(`Digest failed: ${msg}`).catch(() => {});
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  console.log("Personal assistant is on.");

  // Catches WhatsApp notifications before you open the chat, but only while this window is open
  if (config.ENABLE_WHATSAPP) startWhatsAppWatcher();

  // Optional automatic digests (off unless DIGEST_SCHEDULE is set in .env)
  for (const expr of config.DIGEST_SCHEDULE.split(",").map((s) => s.trim()).filter(Boolean)) {
    cron.schedule(expr, () => void digestOnce(), { timezone: config.TIMEZONE });
    console.log(`[schedule] automatic digest at "${expr}"`);
  }

  await sendViaBot("Assistant is on. Send /digest when you want a summary, or /help for options.").catch(() => {});
  console.log("Press Ctrl+C or send /stop to the bot to turn it off.");
  await listenForCommands(digestOnce, () => {
    console.log("Stopped from Telegram.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
