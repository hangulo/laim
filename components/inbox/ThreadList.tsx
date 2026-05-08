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

type Tab = "primary" | "promotions" | "updates";

const TABS: { id: Tab; label: string; labelIds: string[] }[] = [
  { id: "primary",    label: "Primary",    labelIds: ["INBOX", "CATEGORY_PERSONAL"] },
  { id: "promotions", label: "Promotions", labelIds: ["INBOX", "CATEGORY_PROMOTIONS"] },
  { id: "updates",    label: "Updates",    labelIds: ["INBOX", "CATEGORY_UPDATES"] },
];

function fmtFrom(raw: string): string {
  const m = raw.match(/^"?([^"<]*?)"?\s*<.*>$/);
  return (m ? m[1] : raw).trim() || raw;
}

function fmtDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ThreadList() {
  const accountId = useApp((s) => s.activeAccountId);
  const cursor = useApp((s) => s.cursor);
  const setCursor = useApp((s) => s.setCursor);
  const router = useRouter();
  const { registerThreadList } = useActions();
  const [activeTab, setActiveTab] = useState<Tab>("primary");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (tab: Tab) => {
    if (!accountId) return;
    setLoading(true);
    try {
      const labelIds = TABS.find((t) => t.id === tab)!.labelIds;
      const params = new URLSearchParams({
        accountId,
        max: "50",
        label: labelIds.join(","),
      });
      const res = await fetch(`/api/gmail/threads?${params}`);
      const data = await res.json();
      setThreads(data.threads ?? []);
      setCursor(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, setCursor]);

  useEffect(() => {
    void load(activeTab);
    const handler = () => void load(activeTab);
    window.addEventListener("laim:refresh-threads", handler);
    return () => window.removeEventListener("laim:refresh-threads", handler);
  }, [load, activeTab]);

  useEffect(() => {
    if (!accountId) return;
    const list = threads.map((t) => ({ id: t.id, accountId }));
    registerThreadList(list);
    useApp.getState().setThreadList(list);
  }, [threads, accountId, registerThreadList]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setThreads([]);
    setCursor(0);
  }

  if (!accountId) {
    return <div className="p-6 text-sm text-neutral-500">No active account.</div>;
  }

  return (
    <div className="divide-y divide-neutral-100">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-200 bg-white">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-blue-600"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {tab.id === "primary" && (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
            {tab.id === "promotions" && (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
            )}
            {tab.id === "updates" && (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-4 text-xs text-neutral-400">
          {loading ? "syncing…" : `${threads.length} threads`}
        </div>
      </div>

      {/* Thread rows */}
      {threads.map((t, i) => (
        <button
          key={t.id}
          onClick={() => {
            setCursor(i);
            router.push(`/thread/${t.id}?accountId=${accountId}`);
          }}
          onMouseEnter={() => setCursor(i)}
          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
            i === cursor ? "bg-blue-50" : "hover:bg-neutral-50"
          }`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${t.unread ? "bg-blue-500" : "bg-transparent"}`} />
          <span className="w-44 shrink-0 truncate font-medium text-neutral-900">{fmtFrom(t.from)}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className={t.unread ? "font-semibold text-neutral-900" : "text-neutral-700"}>
              {t.subject || "(no subject)"}
            </span>
            <span className="ml-2 text-neutral-400">{t.snippet}</span>
          </span>
          {t.starred && <span className="shrink-0 text-amber-400">★</span>}
          <span className="w-16 shrink-0 text-right font-mono text-xs text-neutral-400">{fmtDate(t.date)}</span>
        </button>
      ))}

      {threads.length === 0 && !loading && (
        <div className="p-10 text-center text-sm text-neutral-400">No messages here.</div>
      )}
      {loading && threads.length === 0 && (
        <div className="space-y-px">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="h-2 w-2 rounded-full bg-neutral-100" />
              <div className="h-3 w-36 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 flex-1 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-10 animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
