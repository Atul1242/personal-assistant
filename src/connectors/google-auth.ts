import fs from "node:fs";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import { config, paths } from "../config.js";
import { readJson, writeJson } from "../store.js";

// Read-only access: the assistant never sends mail or edits your calendar.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

interface SavedToken {
  type: "authorized_user";
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

/** Interactive one-time login: opens a browser window for Google consent. */
export async function authorizeGoogleInteractive(): Promise<void> {
  if (!fs.existsSync(config.GOOGLE_CREDENTIALS_PATH)) {
    throw new Error(
      `Google OAuth client file not found at ${config.GOOGLE_CREDENTIALS_PATH}. See README -> "Google setup".`,
    );
  }
  const client = await authenticate({ scopes: SCOPES, keyfilePath: config.GOOGLE_CREDENTIALS_PATH });
  const keys = readJson<{ installed?: { client_id: string; client_secret: string }; web?: { client_id: string; client_secret: string } }>(
    config.GOOGLE_CREDENTIALS_PATH,
    {},
  );
  const key = keys.installed ?? keys.web;
  if (!key || !client.credentials.refresh_token) {
    throw new Error("Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and retry.");
  }
  const token: SavedToken = {
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  };
  writeJson(paths.googleToken, token);
}

/** Returns an authorised client from the saved token, or throws if `npm run auth:google` hasn't been run. */
export function getGoogleAuth() {
  const token = readJson<SavedToken | null>(paths.googleToken, null);
  if (!token) throw new Error("Google not connected. Run: npm run auth:google");
  return google.auth.fromJSON(token);
}
