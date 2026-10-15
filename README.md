# Personal Assistant

A private assistant that reads your **WhatsApp**, **Telegram**, **Gmail** and **Google Calendar** and sends you a clear summary on Telegram, written by an AI model running **on your own computer**.

Send `/digest` to your Telegram bot and get back what needs your attention, what each chat was about, new job emails and your schedule.

- **Fully local AI.** Summaries are written by [Ollama](https://ollama.com) on your own GPU. No OpenAI, Claude or other cloud AI.
- **No WhatsApp account risk.** It never connects to WhatsApp. It reads the notifications the official WhatsApp Desktop app shows on Windows.
- **Read-only.** It never sends mail, edits your calendar or replies to anyone.
- **On demand.** Nothing runs until you ask, and the AI model is unloaded right after.

## Example digest

```
YOUR DIGEST - 15 Oct 2026, 7:30 pm

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

## How it works

```
WhatsApp Desktop notifications ─┐
Telegram (official API)        ─┤                                    ┌─ /digest from your phone
Gmail (read-only)              ─┼─► local AI, one chat at a time ─► Telegram bot
Google Calendar (read-only)    ─┘                                    └─ digest back to you
```

The AI reads each chat separately and answers in a fixed format, and code assembles the digest, so every chat appears exactly once. Details that must be exact (schedule, job emails and message counts) are written by code, not the AI.

## Usage

**From your phone.** Double-click `Start Assistant.bat` on your computer (or run `npm start`), then send these to your bot:

| Command | What it does |
|---|---|
| `/digest` | Everything new since your last digest |
| `/digest 6h` | The last 6 hours (`h` = hours, `d` = days, e.g. `/digest 2d`) |
| `/stop` | Turns the assistant off |
| `/help` | Lists the commands |

**From your computer.** Double-click `Get Digest Now.bat` (or run `npm run digest`) to make one digest, send it to Telegram and exit.

A digest takes about 5 seconds per chat. Ollama is started automatically if it isn't running.

## Setup

Requirements: Windows 10/11, [Node.js](https://nodejs.org) 22.13+, [Ollama](https://ollama.com/download), and a GPU with 6 GB+ VRAM (or use a smaller model).

```bash
npm install
copy .env.example .env
```

Then fill in `.env` in these steps.

### 1. Local AI model

```bash
npm run setup:model
```

Downloads `qwen2.5:7b` (about 4.7 GB) once. It understands English, Hindi and Hinglish. On a weaker computer, set `OLLAMA_MODEL=llama3.2:3b` and run the command again.

### 2. Telegram

1. Get an `api_id` and `api_hash` at <https://my.telegram.org> → *API development tools* (platform: Desktop), and put them in `.env`.
2. Run `npm run auth:telegram` and log in. Paste the two lines it prints (`TELEGRAM_SESSION` and `TELEGRAM_OWNER_CHAT_ID`) into `.env`.
3. Create a bot with [@BotFather](https://t.me/BotFather), put its token in `TELEGRAM_BOT_TOKEN`, then open the bot and press **Start**.
4. Set `USER_NAME` to your first name so the assistant can tell which requests are meant for you.

### 3. WhatsApp

1. Install **WhatsApp** from the Microsoft Store and link it to your phone.
2. In WhatsApp, go to *Settings → Notifications* and turn on notifications with **message previews**.
3. In Windows, go to *Settings → System → Notifications* and make sure WhatsApp is allowed.
4. Have someone message you, then run `npm run check:whatsapp`. It should report a captured message.

Windows removes a notification once you open that chat, so a digest sees WhatsApp messages you haven't opened yet, plus any caught while the assistant was running. Muted chats don't create notifications.

### 4. Gmail and Calendar

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Gmail API** and **Google Calendar API**.
2. On the *OAuth consent screen* page, choose External and add your Gmail address as a **test user**.
3. Go to *Credentials → Create credentials → OAuth client ID → **Desktop app***. Download the JSON and save it as `credentials.json` in this folder.
4. Run `npm run auth:google` and approve access in the browser.

## Commands

| Command | Purpose |
|---|---|
| `npm start` | Start the assistant and wait for bot commands |
| `npm run digest` | Make one digest now |
| `npm run setup:model` | Download the local AI model |
| `npm run auth:telegram` | Log in to Telegram |
| `npm run auth:google` | Connect Gmail and Calendar |
| `npm run check:whatsapp` | Test WhatsApp notification capture |
| `npm run typecheck` | Type-check the code |

## Project structure

```
src/
  index.ts            Starts the assistant and waits for bot commands
  cli.ts              One-off commands (digest, setup, logins, checks)
  bot.ts              Telegram bot commands
  digest.ts           Collects new messages from every source
  summarizer.ts       Local AI summaries and digest layout
  delivery.ts         Sends the digest to Telegram and saves a copy
  config.ts           Settings from .env
  connectors/         Gmail, Calendar, Telegram and WhatsApp readers
```

## Privacy

All reading and AI processing happens on your computer. The only network traffic is to Google's and Telegram's official APIs, to read your data and to deliver the digest to you. Your logins and messages stay in `.env`, `credentials.json` and `data/`, which are never committed.

## License

[MIT](LICENSE)
