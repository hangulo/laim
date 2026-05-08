"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  accountId: string;
}

function fmtDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  if (diffDays < 365) return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
}

export function SenderHistory({
  senderEmail,
  accountId,
  currentThreadId,
}: {
  senderEmail: string;
  accountId: string;
  currentThreadId: string;
}) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!senderEmail) return;
    setLoading(true);
    fetch(`/api/gmail/threads?accountId=${accountId}&q=${encodeURIComponent(`from:${senderEmail}`)}&max=6`)
      .then((r) => r.json())
      .then((d) => {
        const list: ThreadSummary[] = (d.threads ?? [])
          .filter((t: ThreadSummary) => t.id !== currentThreadId)
          .slice(0, 3)
          .map((t: ThreadSummary) => ({ ...t, accountId }));
        setThreads(list);
      })
      .finally(() => setLoading(false));
  }, [senderEmail, accountId, currentThreadId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return <p className="text-xs text-neutral-400">No other threads from this sender.</p>;
  }

  return (
    <div className="space-y-1">
      {threads.map((t) => (
        <Link
          key={t.id}
          href={`/thread/${t.id}?accountId=${t.accountId}`}
          className="block rounded-lg p-2.5 text-left transition-colors hover:bg-neutral-100"
        >
          <div className="flex items-start justify-between gap-2">
            <span className={`truncate text-xs ${t.unread ? "font-semibold text-neutral-900" : "text-neutral-700"}`}>
              {t.subject || "(no subject)"}
            </span>
            <span className="shrink-0 text-[10px] text-neutral-400">{fmtDate(t.date)}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-neutral-400">{t.snippet}</p>
        </Link>
      ))}
    </div>
  );
}
