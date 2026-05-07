import { google } from "googleapis";
import { authedClient } from "./client";

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  hangoutLink?: string;
  responseStatus: "accepted" | "declined" | "tentative" | "needsAction" | "owner" | "unknown";
}

export async function listEvents(
  accountId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEvent[]> {
  const auth = await authedClient(accountId);
  const cal = google.calendar({ version: "v3", auth });

  const res = await cal.events.list({
    calendarId: "primary",
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  return (res.data.items ?? []).map((e): CalendarEvent => {
    const start = e.start?.dateTime ?? e.start?.date ?? "";
    const end = e.end?.dateTime ?? e.end?.date ?? "";
    const allDay = !e.start?.dateTime;
    const self = e.attendees?.find((a) => a.self);
    const status = (self?.responseStatus ?? (e.organizer?.self ? "owner" : "unknown")) as CalendarEvent["responseStatus"];
    return {
      id: e.id ?? "",
      summary: e.summary ?? "(no title)",
      start,
      end,
      allDay,
      location: e.location ?? undefined,
      hangoutLink: e.hangoutLink ?? undefined,
      responseStatus: status,
    };
  });
}
