import readline from "node:readline/promises";
import { TelegramClient, Logger } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { config } from "../config.js";
import type { InboxItem } from "../types.js";

const MAX_MESSAGES_PER_CHAT = 25;

function requireApiCreds(): { apiId: number; apiHash: string } {
  if (!config.TELEGRAM_API_ID || !config.TELEGRAM_API_HASH) {
    throw new Error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env (from https://my.telegram.org).");
  }
  return { apiId: config.TELEGRAM_API_ID, apiHash: config.TELEGRAM_API_HASH };
}

function makeClient(session: string): TelegramClient {
  const { apiId, apiHash } = requireApiCreds();
  const logger = new Logger();
  logger.setLevel("error" as never);
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5,
    baseLogger: logger,
  });
}

/** One-time interactive login. Prints a session string to paste into .env as TELEGRAM_SESSION. */
export async function loginTelegramInteractive(): Promise<{ session: string; userId: string }> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const client = makeClient("");
  try {
    await client.start({
      phoneNumber: () => rl.question("Phone number (with country code, e.g. +91...): "),
      phoneCode: () => rl.question("Login code Telegram sent you: "),
      password: (hint) => rl.question(`2FA password${hint ? ` (hint: ${hint})` : ""}: `),
      onError: (err) => console.error(err.message),
    });
    const me = await client.getMe();
    return { session: client.session.save() as unknown as string, userId: String(me.id) };
  } finally {
    rl.close();
    await client.destroy();
  }
}

/** Connects with the saved session. Caller must call destroy() (disconnect() leaves a ping loop running). */
export async function connectTelegram(): Promise<TelegramClient> {
  if (!config.TELEGRAM_SESSION) throw new Error("Telegram not connected. Run: npm run auth:telegram");
  const client = makeClient(config.TELEGRAM_SESSION);
  await client.connect();
  return client;
}

/** Unread messages from your personal chats and groups (broadcast channels and archived chats are skipped). */
export async function fetchTelegram(since: Date): Promise<InboxItem[]> {
  const client = await connectTelegram();
  try {
    const dialogs = await client.getDialogs({ limit: 100 });
    const unread = dialogs.filter(
      (d) => d.unreadCount > 0 && !d.archived && (d.isUser || d.isGroup),
    );

    const items: InboxItem[] = [];
    for (const dialog of unread) {
      const limit = Math.min(dialog.unreadCount, MAX_MESSAGES_PER_CHAT);
      const messages = await client.getMessages(dialog.entity, { limit });
      for (const m of messages) {
        const text = m.message?.trim();
        if (!text || m.out) continue;
        const timestamp = new Date(m.date * 1000);
        if (timestamp < since) continue;
        const sender = (m as unknown as { sender?: { firstName?: string; title?: string } }).sender;
        items.push({
          source: "telegram",
          from: dialog.isGroup ? sender?.firstName ?? "Someone" : dialog.title ?? "Unknown",
          title: dialog.isGroup ? dialog.title : undefined,
          text,
          timestamp,
        });
      }
    }
    return items;
  } finally {
    await client.destroy();
  }
}

/** Sends a message to your own "Saved Messages" (fallback delivery when no bot is configured). */
export async function sendToSavedMessages(text: string): Promise<void> {
  const client = await connectTelegram();
  try {
    await client.sendMessage("me", { message: text });
  } finally {
    await client.destroy();
  }
}
