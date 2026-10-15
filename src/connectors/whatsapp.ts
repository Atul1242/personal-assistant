import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config, paths } from "../config.js";
import { readJson, writeJson } from "../store.js";
import type { InboxItem } from "../types.js";

/**
 * WhatsApp without touching WhatsApp's servers.
 *
 * WhatsApp has no official API for personal accounts, and unofficial clients risk getting your
 * number restricted. Instead, this reads the notifications the official WhatsApp Desktop app
 * shows on Windows. Windows keeps them in a local database (wpndatabase.db); we poll it and
 * buffer new WhatsApp notifications in data/. WhatsApp can't see or detect any of this.
 *
 * Limits: only chats that produce notifications are captured (muted chats aren't), and
 * WhatsApp Desktop must be running with message previews turned on.
 */

interface StoredMessage {
  id: number;
  chat: string;
  text: string;
  timestamp: string;
}

const KEEP_DAYS = 3;
const WINDOWS_EPOCH_OFFSET_MS = 11644473600000; // FILETIME (1601) -> Unix epoch (1970)
const NOTIFICATION_DB = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Microsoft",
  "Windows",
  "Notifications",
  "wpndatabase.db",
);

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Pulls the <text> lines out of a toast's XML payload: first is the chat name, the rest is the message. */
function parseToast(xml: string): { chat: string; text: string } | undefined {
  const texts = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => decodeXml(m[1]).trim()).filter(Boolean);
  if (texts.length < 2) return undefined;
  return { chat: texts[0], text: texts.slice(1).join(" ") };
}

/** Reads WhatsApp notifications currently held by Windows. The live DB is locked, so we read a copy. */
function readNotificationDb(): StoredMessage[] {
  if (process.platform !== "win32") throw new Error("WhatsApp reading needs Windows with the WhatsApp Desktop app.");
  if (!fs.existsSync(NOTIFICATION_DB)) throw new Error("Windows notification database not found.");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-wpn-"));
  try {
    const copy = path.join(dir, "wpn.db");
    fs.copyFileSync(NOTIFICATION_DB, copy);
    for (const ext of ["-wal", "-shm"]) {
      if (fs.existsSync(NOTIFICATION_DB + ext)) fs.copyFileSync(NOTIFICATION_DB + ext, copy + ext);
    }

    const db = new DatabaseSync(copy);
    try {
      const rows = db
        .prepare(
          `SELECT n.Id AS id,
                  (n.ArrivalTime / 10000) - ${WINDOWS_EPOCH_OFFSET_MS} AS arrivedMs,
                  n.Payload AS payload
             FROM Notification n
             JOIN NotificationHandler h ON h.RecordId = n.HandlerId
            WHERE h.PrimaryId LIKE '%WhatsApp%' AND n.Type = 'toast'`,
        )
        .all() as Array<{ id: number; arrivedMs: number; payload: Uint8Array }>;

      return rows.flatMap((r) => {
        const parsed = parseToast(Buffer.from(r.payload).toString("utf8"));
        return parsed ? [{ id: r.id, ...parsed, timestamp: new Date(r.arrivedMs).toISOString() }] : [];
      });
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Copies any new WhatsApp notifications into the local buffer. Returns how many were added. */
export function captureWhatsApp(): number {
  const cutoff = Date.now() - KEEP_DAYS * 86400_000;
  const stored = readJson<StoredMessage[]>(paths.whatsappMessages, []);
  const seen = new Set(stored.map((m) => m.id));
  const fresh = readNotificationDb().filter((m) => !seen.has(m.id));

  const all = stored.concat(fresh).filter((m) => new Date(m.timestamp).getTime() >= cutoff);
  if (fresh.length || all.length !== stored.length) writeJson(paths.whatsappMessages, all);
  return fresh.length;
}

/**
 * Polls in the background. Notifications disappear from Windows once you open the chat or
 * dismiss them, so polling often catches them before that.
 */
export function startWhatsAppWatcher(): void {
  const tick = () => {
    try {
      const added = captureWhatsApp();
      if (added) console.log(`[whatsapp] captured ${added} new message(s)`);
    } catch (err) {
      console.error("[whatsapp]", err instanceof Error ? err.message : err);
    }
  };
  tick();
  setInterval(tick, config.WHATSAPP_POLL_SECONDS * 1000);
  console.log(`[whatsapp] watching WhatsApp Desktop notifications every ${config.WHATSAPP_POLL_SECONDS}s`);
}

/** Buffered messages since `since` (also grabs anything currently in the notification centre). */
export function readWhatsAppSince(since: Date): InboxItem[] {
  captureWhatsApp();
  return readJson<StoredMessage[]>(paths.whatsappMessages, [])
    .filter((m) => new Date(m.timestamp) >= since)
    .map((m) => ({
      source: "whatsapp" as const,
      from: m.chat,
      text: m.text,
      timestamp: new Date(m.timestamp),
    }));
}
