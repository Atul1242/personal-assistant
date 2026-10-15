import { config } from "./config.js";
import { sendViaBot } from "./delivery.js";

interface Update {
  update_id: number;
  message?: { chat: { id: number }; text?: string; date: number };
}

export interface DigestRequest {
  /** Look back this many hours instead of "since the last digest" */
  sinceHours?: number;
}

/** Commands sent while the listener was off are still handled if they are at most this old */
const MAX_COMMAND_AGE_SECONDS = 10 * 60;

const HELP = `Commands:
/digest - summary of everything new since your last digest
/digest 6h - summary of the last 6 hours (use h for hours, d for days, e.g. /digest 2d)
/stop - turn the assistant off on your computer
/help - show this list`;

/** Parses "6h", "2d" or "12" (hours). Returns undefined when no window is given. */
function parseWindow(arg: string | undefined): number | undefined | "invalid" {
  if (!arg) return undefined;
  const m = arg.toLowerCase().match(/^(\d+(?:\.\d+)?)([hd]?)$/);
  if (!m) return "invalid";
  const n = Number(m[1]) * (m[2] === "d" ? 24 : 1);
  return n > 0 && n <= 24 * 14 ? n : "invalid";
}

/**
 * Waits for commands sent to your Telegram bot. Only messages from TELEGRAM_OWNER_CHAT_ID are
 * answered, so nobody else can pull your digest.
 */
export async function listenForCommands(onDigest: (req: DigestRequest) => Promise<void>, onStop: () => void): Promise<void> {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_OWNER_CHAT_ID) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID in .env to control the assistant from Telegram.");
  }
  const api = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;
  let offset = 0;
  let failures = 0;
  console.log("[bot] waiting for commands. Send /digest to your bot.");

  for (;;) {
    try {
      const res = await fetch(`${api}/getUpdates?timeout=25&offset=${offset}`, { signal: AbortSignal.timeout(40_000) });
      const body = (await res.json()) as { ok: boolean; result: Update[]; description?: string };
      if (!body.ok) throw new Error(body.description ?? `HTTP ${res.status}`);
      if (failures >= 3) console.log("[bot] connection restored");
      failures = 0;
      for (const update of body.result ?? []) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg?.text || String(msg.chat.id) !== config.TELEGRAM_OWNER_CHAT_ID) continue;
        if (Date.now() / 1000 - msg.date > MAX_COMMAND_AGE_SECONDS) continue; // stale, sent long ago

        const [command, arg] = msg.text.trim().toLowerCase().split(/\s+/);
        if (command === "/digest" || command === "/summary") {
          const sinceHours = parseWindow(arg);
          if (sinceHours === "invalid") {
            await sendViaBot("I didn't understand that time window. Try /digest 6h or /digest 2d.");
            continue;
          }
          await sendViaBot(sinceHours ? `Reading the last ${arg}. This takes about a minute...` : "Reading your new messages. This takes about a minute...");
          await onDigest({ sinceHours });
        } else if (command === "/stop") {
          await sendViaBot("Assistant turned off. Start it again on your computer when you need it.");
          onStop();
          return;
        } else if (command === "/start" || command === "/help") {
          await sendViaBot(`Your assistant is on.\n\n${HELP}`);
        } else {
          await sendViaBot(`Unknown command.\n\n${HELP}`);
        }
      }
    } catch (err) {
      // Brief network blips are normal (Wi-Fi changes, sleep); only report if it keeps failing
      failures++;
      if (failures === 3) console.error("[bot] can't reach Telegram, retrying:", err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
