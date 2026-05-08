"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { useActions } from "@/components/shortcuts/ActionContext";

interface Thread {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  unread: boolean;
  starred: boolean;
}

function fmtFrom(raw: string): string {
  const m = raw.match(/^"?([^"<]*?)"?\s*<.*>$/);
  return (m ? m[1] : raw).trim() || raw;
}

function fmtDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  if (same) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ThreadList() {
  const accountId = useApp((s) => s.activeAccountId);
  const cursor = useApp((s) => s.cursor);
  const setCursor = useApp((s) => s.setCursor);
  const router = useRouter();
  const { registerThreadList } = useActions();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/gmail/threads?accountId=${accountId}&max=50`);
      const data = await res.json();
      setThreads(data.threads ?? []);
      setCursor(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, setCursor]);

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener("laim:refresh-threads", handler);
    return () => window.removeEventListener("laim:refresh-threads", handler);
  }, [load]);

  useEffect(() => {
    if (!accountId) return;
    const list = threads.map((t) => ({ id: t.id, accountId }));
    registerThreadList(list);
    useApp.getState().setThreadList(list);
  }, [threads, accountId, registerThreadList]);

  if (!accountId) {
    return <div className="p-6 text-sm text-neutral-500">No active account.</div>;
  }

  return (
    <div className="divide-y divide-neutral-100">
      <div className="flex items-center justify-between px-4 py-2 text-xs text-neutral-500">
        <span>Inbox · {threads.length} threads</span>
        <span className="font-mono">{loading ? "syncing…" : "j/k navigate · e archive · r reply"}</span>
      </div>
      {threads.map((t, i) => (
        <button
          key={t.id}
          onClick={() => {
            setCursor(i);
            router.push(`/thread/${t.id}?accountId=${accountId}`);
          }}
          onMouseEnter={() => setCursor(i)}
          className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
            i === cursor ? "bg-blue-50" : "hover:bg-neutral-50"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${t.unread ? "bg-blue-500" : "bg-transparent"}`} />
          <span className="w-44 truncate font-medium">{fmtFrom(t.from)}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className={t.unread ? "font-semibold" : ""}>{t.subject || "(no subject)"}</span>
            <span className="ml-2 text-neutral-500">{t.snippet}</span>
          </span>
          {t.starred && <span className="text-amber-500">★</span>}
          <span className="w-16 text-right font-mono text-xs text-neutral-500">{fmtDate(t.date)}</span>
        </button>
      ))}
      {threads.length === 0 && !loading && (
        <div className="p-10 text-center text-sm text-neutral-400">Inbox zero. ✨</div>
      )}
    </div>
  );
}
