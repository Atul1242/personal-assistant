import type { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from "baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { paths } from "../config.js";
import { readJson, writeJson } from "../store.js";
import type { InboxItem } from "../types.js";

/**
 * WhatsApp has no official API for personal accounts. This uses Baileys, which connects as a
 * "Linked device" (like WhatsApp Web). Messages are buffered locally while `npm start` is running,
 * and each digest reads from that buffer.
 */

interface StoredMessage {
  chat: string;
  group?: string;
  from: string;
  text: string;
  timestamp: string;
}

const KEEP_DAYS = 3;
const groupNames = new Map<string, string>();

function extractText(msg: WAMessage): string | undefined {
  const m = msg.message;
  if (!m) return undefined;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    (m.imageMessage ? "[photo]" : undefined) ??
    (m.audioMessage ? "[voice note]" : undefined) ??
    (m.documentMessage ? `[document: ${m.documentMessage.fileName ?? "file"}]` : undefined) ??
    undefined
  )?.trim();
}

async function groupName(sock: WASocket, jid: string): Promise<string> {
  const cached = groupNames.get(jid);
  if (cached) return cached;
  try {
    const meta = await sock.groupMetadata(jid);
    groupNames.set(jid, meta.subject);
    return meta.subject;
  } catch {
    return "a group";
  }
}

function saveMessages(newOnes: StoredMessage[]): void {
  const cutoff = Date.now() - KEEP_DAYS * 86400_000;
  const all = readJson<StoredMessage[]>(paths.whatsappMessages, [])
    .concat(newOnes)
    .filter((m) => new Date(m.timestamp).getTime() >= cutoff);
  writeJson(paths.whatsappMessages, all);
}

interface StartOptions {
  /** Resolve once connected (used by the one-time QR login). */
  onOpen?: () => void;
}

export async function startWhatsApp(opts: StartOptions = {}): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(paths.whatsappAuth);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    markOnlineOnConnect: false, // don't show you as "online" or send read receipts
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\nScan this QR in WhatsApp -> Settings -> Linked devices -> Link a device:\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      console.log("[whatsapp] connected");
      opts.onOpen?.();
    }
    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.error("[whatsapp] logged out. Delete data/whatsapp-auth and run: npm run auth:whatsapp");
      } else {
        console.log(`[whatsapp] connection closed (${code ?? "unknown"}), reconnecting...`);
        setTimeout(() => void startWhatsApp(opts), 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const stored: StoredMessage[] = [];
    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (!jid || msg.key.fromMe) continue;
      if (isJidBroadcast(jid) || isJidNewsletter(jid)) continue; // skip status updates and channels
      const text = extractText(msg);
      if (!text) continue;
      const isGroup = Boolean(isJidGroup(jid));
      stored.push({
        chat: jid,
        group: isGroup ? await groupName(sock, jid) : undefined,
        from: msg.pushName ?? jid.split("@")[0],
        text,
        timestamp: new Date(Number(msg.messageTimestamp ?? Date.now() / 1000) * 1000).toISOString(),
      });
    }
    if (stored.length) saveMessages(stored);
  });

  return sock;
}

/** Messages buffered since `since` by the running listener. */
export function readWhatsAppSince(since: Date): InboxItem[] {
  return readJson<StoredMessage[]>(paths.whatsappMessages, [])
    .filter((m) => new Date(m.timestamp) >= since)
    .map((m) => ({
      source: "whatsapp" as const,
      from: m.from,
      title: m.group,
      text: m.text,
      timestamp: new Date(m.timestamp),
    }));
}
