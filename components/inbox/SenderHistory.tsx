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
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
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
    fetch(`/api/gmail/threads?accountId=${accountId}&q=${encodeURIComponent(`from:${senderEmail}`)}&max=12`)
      .then((r) => r.json())
      .then((d) => {
        const list: ThreadSummary[] = (d.threads ?? [])
          .filter((t: ThreadSummary) => t.id !== currentThreadId)
          .slice(0, 10)
          .map((t: ThreadSummary) => ({ ...t, accountId }));
        setThreads(list);
      })
      .finally(() => setLoading(false));
  }, [senderEmail, accountId, currentThreadId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5 rounded-lg p-2.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-full animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return <p className="text-xs text-neutral-400">No other threads from this sender.</p>;
  }

  return (
    <div className="divide-y divide-neutral-100">
      {threads.map((t) => (
        <Link
          key={t.id}
          href={`/thread/${t.id}?accountId=${t.accountId}`}
          className="block px-1 py-3 transition-colors hover:bg-neutral-50 first:pt-0"
        >
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className={`text-xs font-medium leading-snug ${t.unread ? "text-neutral-900" : "text-neutral-600"}`}
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {t.unread && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 align-middle" />}
              {t.subject || "(no subject)"}
            </span>
            <span className="shrink-0 text-[10px] text-neutral-400 mt-0.5">{fmtDate(t.date)}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-400"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {t.snippet}
          </p>
        </Link>
      ))}
    </div>
  );
}
