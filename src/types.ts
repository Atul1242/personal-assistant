/** A single message from any chat or mail source, normalised for summarising. */
export interface InboxItem {
  source: "gmail" | "telegram" | "whatsapp";
  /** Chat name, group name or email sender */
  from: string;
  /** Email subject or chat/group title */
  title?: string;
  text: string;
  timestamp: Date;
}

export interface CalendarItem {
  title: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  location?: string;
  meetLink?: string;
}

export interface Collected {
  since: Date;
  items: InboxItem[];
  events: CalendarItem[];
  errors: string[];
}
