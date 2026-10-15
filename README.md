# Personal Assistant

A personal assistant that reads your **WhatsApp**, **Telegram**, **Gmail** and **Google Calendar**, then uses Claude to send you a short digest on Telegram: what needs your attention, what's on your schedule, and a one-line roundup of everything else.

- Scheduled digests (default 8 AM, 1 PM, 8 PM) plus `/digest` on demand from your Telegram bot
- Read-only: it never sends mail, edits your calendar or replies to anyone
- Everything (logins, tokens, buffered messages) stays on your machine in `data/` and `.env`, which are git-ignored

## How it works

```
WhatsApp (linked device) ──► buffered in data/ ─┐
Telegram (your account)  ───────────────────────┤
Gmail (unread inbox)     ───────────────────────┼──► Claude summary ──► Telegram bot / Saved Messages
Google Calendar (next 36h) ─────────────────────┘
```

| File | Purpose |
|---|---|
| `src/index.ts` | Long-running process: WhatsApp listener, schedule, bot commands |
| `src/cli.ts` | One-off commands: `digest`, `auth:*` |
| `src/digest.ts` | Collects new items since the last digest and sends the summary |
| `src/summarizer.ts` | Claude prompt and API call |
| `src/connectors/*` | Gmail, Calendar, Telegram, WhatsApp |

## Setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
```

Then fill in `.env` step by step:

### 1. Claude
Create an API key at <https://console.anthropic.com/settings/keys> and set `ANTHROPIC_API_KEY`.

### 2. Google (Gmail + Calendar)
1. Go to <https://console.cloud.google.com/>, create a project.
2. Enable **Gmail API** and **Google Calendar API** (APIs & Services → Library).
3. OAuth consent screen → External → add yourself as a **test user**.
4. Credentials → Create credentials → OAuth client ID → **Desktop app** → download the JSON and save it as `credentials.json` in this folder.
5. Run `npm run auth:google` and approve in the browser.

### 3. Telegram
1. Get `api_id` and `api_hash` at <https://my.telegram.org> → API development tools. Put them in `.env`.
2. Run `npm run auth:telegram`, enter your phone number and login code, and paste the printed `TELEGRAM_SESSION=...` line into `.env`.
3. (Recommended, for notifications) Create a bot with [@BotFather](https://t.me/BotFather), set `TELEGRAM_BOT_TOKEN`, get your numeric id from [@userinfobot](https://t.me/userinfobot) and set `TELEGRAM_OWNER_CHAT_ID`, then send `/start` to your bot.

### 4. WhatsApp
Run `npm run auth:whatsapp` and scan the QR code from WhatsApp → Settings → Linked devices → Link a device.

> WhatsApp has no official API for personal accounts. This project uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial linked-device client. It only reads incoming messages, but unofficial clients are against WhatsApp's terms and accounts can be restricted. Set `ENABLE_WHATSAPP=false` if you'd rather not take that risk.

WhatsApp messages are only captured while `npm start` is running.

## Running

```bash
npm start          # keep running: WhatsApp listener + scheduled digests + /digest command
npm run digest     # build and send one digest right now
npm run typecheck
```

To keep it running all the time, run it on an always-on machine or a small VPS (for example with `pm2 start "npm start" --name assistant`).

## Privacy

Message text, sender names and email subjects/snippets are sent to the Claude API to write the summary. Nothing else leaves your machine. Don't commit `.env`, `credentials.json` or `data/`.
