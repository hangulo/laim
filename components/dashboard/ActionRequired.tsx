"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Thread {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  accountId: string;
  accountEmail: string;
}

function meEmails(rawTo: string): string[] {
  return rawTo
    .split(",")
    .map((s) => {
      const m = s.match(/<([^>]+)>/);
      return (m ? m[1] : s).trim().toLowerCase();
    })
    .filter(Boolean);
}

export function ActionRequired({ ownEmails }: { ownEmails: string[] }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gmail/threads?aggregate=1&max=20")
      .then((r) => r.json())
      .then((d) => {
        const filtered: Thread[] = (d.threads ?? []).filter((t: Thread & { to: string }) => {
          const tos = meEmails(t.to ?? "");
          const fromMine = ownEmails.some((e) =>
            (t.from ?? "").toLowerCase().includes(e.toLowerCase()),
          );
          const youAreTo = ownEmails.some((e) => tos.includes(e.toLowerCase()));
          return youAreTo && !fromMine;
        });
        setThreads(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ownEmails]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold">Gmail</h2>
        <span className="text-xs text-neutral-500">
          {loading ? "loading…" : `${threads.length} action required`}
        </span>
      </header>
      <div className="divide-y divide-neutral-100">
        {threads.length === 0 && !loading && (
          <div className="p-4 text-xs text-neutral-500">Nothing needs you. ✨</div>
        )}
        {threads.map((t) => (
          <Link
            key={`${t.accountId}:${t.id}`}
            href={`/thread/${t.id}?accountId=${t.accountId}`}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[10px]">
                  {t.accountEmail}
                </span>
                <span className="truncate">{t.from}</span>
              </div>
              <div className="truncate text-sm font-medium">{t.subject || "(no subject)"}</div>
              <div className="truncate text-xs text-neutral-500">{t.snippet}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
