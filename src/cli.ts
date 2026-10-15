import { authorizeGoogleInteractive } from "./connectors/google-auth.js";
import { loginTelegramInteractive } from "./connectors/telegram.js";
import { captureWhatsApp } from "./connectors/whatsapp.js";
import { runDigest } from "./digest.js";
import { pullModel } from "./summarizer.js";
import { config } from "./config.js";

const command = process.argv[2];

async function main(): Promise<void> {
  switch (command) {
    case "digest":
      await runDigest();
      break;

    case "auth:google":
      console.log("Opening your browser for Google sign-in (read-only Gmail + Calendar)...");
      await authorizeGoogleInteractive();
      console.log("Google connected. Token saved to data/google-token.json");
      break;

    case "auth:telegram": {
      const session = await loginTelegramInteractive();
      console.log("\nTelegram connected. Add this line to your .env (keep it secret, it is a login):\n");
      console.log(`TELEGRAM_SESSION=${session}\n`);
      break;
    }

    case "setup:model":
      console.log(`Downloading local AI model ${config.OLLAMA_MODEL} (one time, a few GB)...`);
      await pullModel();
      console.log("Model ready.");
      break;

    case "check:whatsapp": {
      const added = captureWhatsApp();
      console.log(`Read Windows notifications: ${added} new WhatsApp message(s) captured.`);
      console.log("If this stays 0 after someone messages you, check the WhatsApp section of the README.");
      break;
    }

    default:
      console.log("Usage: tsx src/cli.ts <digest | setup:model | auth:google | auth:telegram | check:whatsapp>");
      process.exitCode = 1;
  }
}

main()
  .then(() => process.exit())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
