import { config, paths } from "./config.js";
import { fetchCalendar } from "./connectors/calendar.js";
import { fetchGmail } from "./connectors/gmail.js";
import { fetchTelegram } from "./connectors/telegram.js";
import { readWhatsAppSince } from "./connectors/whatsapp.js";
import { deliver } from "./delivery.js";
import { readJson, writeJson } from "./store.js";
import { summarize } from "./summarizer.js";
import type { Collected } from "./types.js";

interface State {
  lastDigestAt?: string;
}

const DEFAULT_LOOKBACK_HOURS = 12;

async function collect(since: Date): Promise<Collected> {
  const data: Collected = { since, items: [], events: [], errors: [] };

  const tasks: Array<[string, boolean, () => Promise<void>]> = [
    ["Gmail", config.ENABLE_GMAIL, async () => void data.items.push(...(await fetchGmail(since)))],
    ["Calendar", config.ENABLE_CALENDAR, async () => void data.events.push(...(await fetchCalendar()))],
    ["Telegram", config.ENABLE_TELEGRAM, async () => void data.items.push(...(await fetchTelegram(since)))],
    ["WhatsApp", config.ENABLE_WHATSAPP, async () => void data.items.push(...readWhatsAppSince(since))],
  ];

  // One broken source shouldn't stop the digest
  await Promise.all(
    tasks
      .filter(([, enabled]) => enabled)
      .map(async ([name, , run]) => {
        try {
          await run();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[${name}] ${msg}`);
          data.errors.push(`${name}: ${msg}`);
        }
      }),
  );

  return data;
}

/** Collects everything new since the last digest, summarises it with Claude and sends it to you. */
export async function runDigest(): Promise<string> {
  const state = readJson<State>(paths.state, {});
  const startedAt = new Date();
  const since = state.lastDigestAt
    ? new Date(state.lastDigestAt)
    : new Date(startedAt.getTime() - DEFAULT_LOOKBACK_HOURS * 3600_000);

  console.log(`[digest] collecting since ${since.toISOString()}`);
  const data = await collect(since);
  console.log(`[digest] ${data.items.length} messages, ${data.events.length} events`);

  const digest = await summarize(data);
  await deliver(digest);

  writeJson(paths.state, { ...state, lastDigestAt: startedAt.toISOString() });
  return digest;
}
