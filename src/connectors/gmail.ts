import { google } from "googleapis";
import { config } from "../config.js";
import type { InboxItem } from "../types.js";
import { getGoogleAuth } from "./google-auth.js";

/** Unread inbox emails received after `since` (subject, sender and snippet only). */
export async function fetchGmail(since: Date): Promise<InboxItem[]> {
  const gmail = google.gmail({ version: "v1", auth: getGoogleAuth() as never });
  const after = Math.floor(since.getTime() / 1000);

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `in:inbox is:unread after:${after} -category:promotions -category:social`,
    maxResults: config.GMAIL_MAX_EMAILS,
  });

  const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);
  const messages = await Promise.all(
    ids.map((id) =>
      gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject"],
      }),
    ),
  );

  return messages.map(({ data }) => {
    const header = (name: string) =>
      data.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
    return {
      source: "gmail" as const,
      from: header("From"),
      title: header("Subject") || "(no subject)",
      text: decodeEntities(data.snippet ?? ""),
      timestamp: new Date(Number(data.internalDate ?? Date.now())),
    };
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
