import { authorizeGoogleInteractive } from "./connectors/google-auth.js";
import { loginTelegramInteractive } from "./connectors/telegram.js";
import { startWhatsApp } from "./connectors/whatsapp.js";
import { runDigest } from "./digest.js";

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

    case "auth:whatsapp":
      await new Promise<void>((resolve) => void startWhatsApp({ onOpen: resolve }));
      console.log("WhatsApp linked. Credentials saved to data/whatsapp-auth");
      // Give Baileys a moment to flush credentials before exiting
      await new Promise((r) => setTimeout(r, 3000));
      break;

    default:
      console.log("Usage: tsx src/cli.ts <digest | auth:google | auth:telegram | auth:whatsapp>");
      process.exitCode = 1;
  }
}

main()
  .then(() => process.exit())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
