# Personal Assistant

A private personal assistant that runs **entirely on your own computer**. It reads your **WhatsApp**, **Telegram**, **Gmail** and **Google Calendar**, and a local AI model (via [Ollama](https://ollama.com)) writes you a short digest: what needs your attention, what's on your schedule, and a one-line roundup of everything else. The digest is sent to you on Telegram.

- **No cloud AI.** No OpenAI or Claude API: the summary is written by a model running on your own GPU/CPU.
- **No WhatsApp account risk.** It never connects to WhatsApp. It reads the notifications the official WhatsApp Desktop app already shows on Windows.
- **Read-only.** It never sends mail, edits your calendar or replies to anyone.
- **Local data.** Logins, tokens and buffered messages stay in `.env` and `data/`, which are git-ignored.

## How it works

```
WhatsApp Desktop notifications (Windows) ─┐
Telegram (your account, official API)  ───┤
Gmail (unread inbox, read-only)        ───┼──► Local AI (Ollama) ──► Telegram bot message to you
Google Calendar (next 36h, read-only)  ───┘
```

| File | Purpose |
|---|---|
| `src/index.ts` | Long-running process: WhatsApp watcher, schedule, bot commands |
| `src/cli.ts` | One-off commands: `digest`, `setup:model`, `auth:*`, `check:whatsapp` |
| `src/digest.ts` | Collects new items since the last digest and sends the summary |
| `src/summarizer.ts` | Local AI prompt and Ollama call |
| `src/connectors/*` | Gmail, Calendar, Telegram, WhatsApp |

## Setup

Requires Windows, Node.js 22.13+ and [Ollama](https://ollama.com/download).

```bash
npm install
cp .env.example .env
```

### 1. Local AI model
Install Ollama, make sure it's running (system tray icon), then download the model once (~4.7 GB):

```bash
npm run setup:model
```

The default `qwen2.5:7b` runs well on a 6 GB GPU and understands English, Hindi and Hinglish. On a weaker machine set `OLLAMA_MODEL=llama3.2:3b` in `.env`.

### 2. WhatsApp (via Windows notifications)
1. Install **WhatsApp** from the Microsoft Store and link it to your phone (this is WhatsApp's own official app).
2. In WhatsApp Desktop → Settings → Notifications: turn on message notifications and **show previews**.
3. In Windows Settings → System → Notifications: make sure WhatsApp notifications are on.
4. Keep WhatsApp Desktop running in the background (Settings → General → Start WhatsApp at login).
5. Ask someone to message you, then run `npm run check:whatsapp`. It should report a captured message.

Limits: muted chats don't create notifications, so they aren't captured. Notifications vanish from Windows once you open that chat, so `npm start` polls every 15 seconds to catch them first.

### 3. Telegram
1. Get `api_id` and `api_hash` at <https://my.telegram.org> → API development tools. Put them in `.env`.
2. Run `npm run auth:telegram`, enter your phone number and login code, and paste the printed `TELEGRAM_SESSION=...` line into `.env`.
3. For notifications on your phone: create a bot with [@BotFather](https://t.me/BotFather), set `TELEGRAM_BOT_TOKEN`, get your numeric id from [@userinfobot](https://t.me/userinfobot) and set `TELEGRAM_OWNER_CHAT_ID`, then send `/start` to your bot. Without a bot, digests go to your Telegram "Saved Messages".

### 4. Google (Gmail + Calendar)
1. Go to <https://console.cloud.google.com/> and create a project.
2. Enable **Gmail API** and **Google Calendar API** (APIs & Services → Library).
3. OAuth consent screen → External → add yourself as a **test user**.
4. Credentials → Create credentials → OAuth client ID → **Desktop app** → download the JSON and save it as `credentials.json` in this folder.
5. Run `npm run auth:google` and approve in the browser.

## Running

```bash
npm start          # keep running: WhatsApp watcher + scheduled digests + /digest bot command
npm run digest     # build and send one digest right now
npm run typecheck
```

Digests go out at 8 AM, 1 PM and 8 PM by default (`DIGEST_SCHEDULE` in `.env`). Send `/digest` to your bot for one on demand. The computer needs to be on for digests and WhatsApp capture.

## Privacy

All reading and AI processing happens on this computer. Only these network connections are made:
- Google's and Telegram's official APIs, to read your mail, calendar and Telegram chats
- Telegram, to deliver the digest to you

Message text never goes to any AI service. Don't commit `.env`, `credentials.json` or `data/`.
