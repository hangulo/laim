import { NextRequest, NextResponse } from "next/server";
import { listEvents, type CalendarEvent } from "@/lib/google/calendar";
import { requireUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const days = Number(req.nextUrl.searchParams.get("days") ?? 3);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const accountId = req.nextUrl.searchParams.get("accountId");
    const targets = accountId
      ? user.accounts.filter((a) => a.id === accountId)
      : user.accounts;

    const events = (
      await Promise.all(
        targets.map(async (a) => {
          try {
            const items = await listEvents(a.id, start, end);
            return items.map((e: CalendarEvent) => ({ ...e, accountId: a.id, accountEmail: a.email }));
          } catch {
            return [];
          }
        }),
      )
    ).flat();

    events.sort((x, y) => (x.start < y.start ? -1 : 1));
    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
