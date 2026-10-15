# Personal Assistant

A private personal assistant that runs **entirely on your own computer**. It reads your **WhatsApp**, **Telegram**, **Gmail** and **Google Calendar**, and a local AI model (via [Ollama](https://ollama.com)) writes you a detailed digest: what needs your attention, what each chat was about, job emails, and your schedule. It runs only when you ask, and the digest is sent to you on Telegram.

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
| `src/index.ts` | On-demand mode: waits for `/digest` from your Telegram bot |
| `src/cli.ts` | One-off commands: `digest`, `setup:model`, `auth:*`, `check:whatsapp` |
| `src/digest.ts` | Collects new items since the last digest and sends the summary |
| `src/summarizer.ts` | Summarises one chat at a time with the local model, then assembles the digest |
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

Limits: muted chats don't create notifications, so they aren't captured. Windows removes a notification once you open that chat, so a digest only sees WhatsApp messages you haven't opened yet, plus anything caught while the assistant was on (it checks every 15 seconds).

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

## Running (on demand)

The assistant does nothing until you ask. Two ways to use it:

**From your phone:** double-click **`Start Assistant.bat`** on your computer (or run `npm start`). Then, from Telegram, send to your bot:

| Command | What it does |
|---|---|
| `/digest` | Summary of everything new since your last digest |
| `/digest 6h` | Summary of the last 6 hours (`h` = hours, `d` = days, e.g. `/digest 2d`) |
| `/stop` | Turns the assistant off |
| `/help` | Lists the commands |

The window must be open for the bot to answer. Close it or send `/stop` when you're done.

**From your computer only:** double-click **`Get Digest Now.bat`** (or run `npm run digest`). It makes one digest, sends it to Telegram, and exits.

Ollama is started automatically when a digest needs it, and the AI model is unloaded from your GPU 2 minutes after each digest. A digest takes about 5 seconds per chat.

Optional: for automatic digests while the assistant is on, set `DIGEST_SCHEDULE` in `.env` (for example `0 8 * * *,0 20 * * *` for 8 AM and 8 PM).

## What a digest looks like

Plain text, no emojis:

```
NEEDS YOUR ATTENTION
- Mom (WhatsApp): Mom asked you to call her when you are free and to bring milk on the way home.
  To do: Call Mom and pick up milk.

WHATSAPP
- College group: Rahul said the lab exam is moved to Friday 10 AM. Priya shared the syllabus PDF.

JOBS AND OPPORTUNITIES
- LinkedIn Job Alerts: You may be a fit for an Intern - Software Development role

SCHEDULE
- Tomorrow 1:30 pm: Dentist, at Smile Clinic

ALL NEW MESSAGES (12)
WhatsApp: College group (8), Mom (2)
Email: LinkedIn Job Alerts (1), Newsletter (1)
```

The AI reads each chat separately and code assembles the digest, so every chat appears exactly once. Exact details (schedule, job emails and message counts) are written by code, not the AI. Set `USER_NAME` in `.env` so it can tell which requests are meant for you.

## Privacy

All reading and AI processing happens on this computer. Only these network connections are made:
- Google's and Telegram's official APIs, to read your mail, calendar and Telegram chats
- Telegram, to deliver the digest to you

Message text never goes to any AI service. Don't commit `.env`, `credentials.json` or `data/`.
