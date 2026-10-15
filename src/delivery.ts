import fs from "node:fs";
import path from "node:path";
import { config, paths } from "./config.js";
import { sendToSavedMessages } from "./connectors/telegram.js";

const TELEGRAM_LIMIT = 4000; // Telegram caps messages at 4096 chars

function chunks(text: string): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > TELEGRAM_LIMIT) {
    const cut = rest.lastIndexOf("\n", TELEGRAM_LIMIT) > 0 ? rest.lastIndexOf("\n", TELEGRAM_LIMIT) : TELEGRAM_LIMIT;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  parts.push(rest);
  return parts;
}

export async function sendViaBot(text: string): Promise<void> {
  for (const part of chunks(text)) {
    const res = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: config.TELEGRAM_OWNER_CHAT_ID, text: part, disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`Telegram bot send failed: ${res.status} ${await res.text()}`);
  }
}

/** Prints the digest, archives it under data/digests, and sends it to you on Telegram. */
export async function deliver(digest: string): Promise<void> {
  console.log(`\n===== Digest =====\n${digest}\n==================\n`);

  fs.mkdirSync(paths.digests, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(paths.digests, `${stamp}.txt`), digest);

  const header = "🗂 Your assistant digest\n\n";
  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_OWNER_CHAT_ID) {
    await sendViaBot(header + digest);
  } else if (config.TELEGRAM_SESSION) {
    for (const part of chunks(header + digest)) await sendToSavedMessages(part);
  } else {
    console.log("(No Telegram delivery configured - digest only printed and saved to data/digests)");
  }
}
