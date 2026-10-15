import { config } from "./config.js";
import { sendViaBot } from "./delivery.js";

interface Update {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
}

/**
 * Listens for commands sent to your Telegram bot. Only messages from TELEGRAM_OWNER_CHAT_ID are
 * answered, so nobody else can pull your digest.
 */
export async function listenForCommands(onDigest: () => Promise<void>): Promise<void> {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_OWNER_CHAT_ID) return;
  const api = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;
  let offset = 0;
  console.log("[bot] listening for /digest");

  for (;;) {
    try {
      const res = await fetch(`${api}/getUpdates?timeout=50&offset=${offset}`);
      const body = (await res.json()) as { ok: boolean; result: Update[] };
      for (const update of body.result ?? []) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg?.text || String(msg.chat.id) !== config.TELEGRAM_OWNER_CHAT_ID) continue;

        const command = msg.text.trim().split(/\s+/)[0].toLowerCase();
        if (command === "/digest" || command === "/summary") {
          await sendViaBot("Working on it...");
          await onDigest();
        } else if (command === "/start" || command === "/help") {
          await sendViaBot("Hi! I send you scheduled digests of WhatsApp, Telegram, Gmail and Calendar.\n\n/digest - get a summary right now");
        }
      }
    } catch (err) {
      console.error("[bot]", err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
