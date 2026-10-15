import cron from "node-cron";
import { listenForCommands } from "./bot.js";
import { config } from "./config.js";
import { startWhatsAppWatcher } from "./connectors/whatsapp.js";
import { runDigest } from "./digest.js";

let running = false;

async function digestOnce(): Promise<void> {
  if (running) return console.log("[digest] already running, skipped");
  running = true;
  try {
    await runDigest();
  } catch (err) {
    console.error("[digest] failed:", err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  console.log("Personal assistant starting...");

  if (config.ENABLE_WHATSAPP) startWhatsAppWatcher();

  for (const expr of config.DIGEST_SCHEDULE.split(",").map((s) => s.trim()).filter(Boolean)) {
    cron.schedule(expr, () => void digestOnce(), { timezone: config.TIMEZONE });
    console.log(`[schedule] digest at "${expr}" (${config.TIMEZONE})`);
  }

  void listenForCommands(digestOnce);
  console.log("Running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
