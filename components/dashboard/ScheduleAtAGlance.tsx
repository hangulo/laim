"use client";

import { useEffect, useState } from "react";

interface Event {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  responseStatus: "accepted" | "declined" | "tentative" | "needsAction" | "owner" | "unknown";
  accountId: string;
  accountEmail: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(iso: string, allDay: boolean) {
  if (allDay) return "all-day";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function statusBadge(s: Event["responseStatus"]) {
  if (s === "accepted" || s === "owner") return { label: "✓ ACCEPTED", cls: "border-green-500 text-green-700" };
  if (s === "declined") return { label: "✕ DECLINED", cls: "border-red-500 text-red-700" };
  if (s === "tentative") return { label: "? TENTATIVE", cls: "border-amber-500 text-amber-700" };
  if (s === "needsAction") return { label: "⏳ PENDING", cls: "border-neutral-400 text-neutral-600" };
  return null;
}

export function ScheduleAtAGlance() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/calendar/events?days=3")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { label: string; date: Date; events: Event[] }[] = [0, 1, 2].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const label =
      offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : DAYS[d.getDay()];
    return {
      label,
      date: d,
      events: events.filter((e) => {
        const s = new Date(e.start);
        return s >= d && s < next;
      }),
    };
  });

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">📅 Schedule at a glance</h2>
        <span className="text-xs text-neutral-400">{loading ? "loading…" : `${events.length} events`}</span>
      </div>

      <div className="space-y-3">
        {days.map((day) => (
          <div key={day.label} className="grid grid-cols-[140px_1fr] items-start gap-3">
            <div className="text-xs">
              <div className="font-medium">{day.label}</div>
              <div className="text-neutral-500">
                {day.date.toLocaleDateString([], { month: "numeric", day: "numeric" })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {day.events.length === 0 && <span className="text-xs text-neutral-400">no events</span>}
              {day.events.map((e) => {
                const badge = statusBadge(e.responseStatus);
                return (
                  <span
                    key={e.id}
                    className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs"
                  >
                    <span className="font-mono text-neutral-500">{fmtTime(e.start, e.allDay)}</span>
                    <span className="text-neutral-900">{e.summary}</span>
                    {badge && (
                      <span className={`rounded border px-1 font-mono text-[10px] ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
