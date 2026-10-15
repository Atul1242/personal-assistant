import { google } from "googleapis";
import { config } from "../config.js";
import type { CalendarItem } from "../types.js";
import { getGoogleAuth } from "./google-auth.js";

/** Upcoming events on your primary calendar for the next CALENDAR_LOOKAHEAD_HOURS. */
export async function fetchCalendar(): Promise<CalendarItem[]> {
  const calendar = google.calendar({ version: "v3", auth: getGoogleAuth() as never });
  const now = new Date();
  const until = new Date(now.getTime() + config.CALENDAR_LOOKAHEAD_HOURS * 3600_000);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  return (res.data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => {
      const allDay = !e.start?.dateTime;
      return {
        title: e.summary ?? "(untitled event)",
        start: new Date(e.start?.dateTime ?? e.start?.date ?? now),
        end: e.end?.dateTime || e.end?.date ? new Date((e.end.dateTime ?? e.end.date)!) : undefined,
        allDay,
        location: e.location ?? undefined,
        meetLink: e.hangoutLink ?? undefined,
      };
    });
}
