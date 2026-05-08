"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type Tab = "primary" | "promotions" | "updates" | "social" | "forums";

const INBOX_TABS: { id: Tab; label: string; labelIds: string[] }[] = [
  { id: "primary",    label: "Primary",    labelIds: ["INBOX", "CATEGORY_PERSONAL"] },
  { id: "promotions", label: "Promotions", labelIds: ["INBOX", "CATEGORY_PROMOTIONS"] },
  { id: "updates",    label: "Updates",    labelIds: ["INBOX", "CATEGORY_UPDATES"] },
  { id: "social",     label: "Social",     labelIds: ["INBOX", "CATEGORY_SOCIAL"] },
  { id: "forums",     label: "Forums",     labelIds: ["INBOX", "CATEGORY_FORUMS"] },
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
  const searchParams = useSearchParams();
  const { registerThreadList } = useActions();

  const activeLabel = searchParams.get("label") ?? "INBOX";
  const isInbox = activeLabel === "INBOX";

  const [activeTab, setActiveTab] = useState<Tab>("primary");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (label: string, tab: Tab, unread: boolean) => {
    if (!accountId) return;
    setLoading(true);
    try {
      let labelIds: string[];
      if (label === "INBOX") {
        labelIds = INBOX_TABS.find((t) => t.id === tab)!.labelIds;
      } else {
        labelIds = [label];
      }
      const params = new URLSearchParams({ accountId, max: "50", label: labelIds.join(",") });
      if (unread) params.set("q", "is:unread");
      const res = await fetch(`/api/gmail/threads?${params}`);
      const data = await res.json();
      setThreads(data.threads ?? []);
      setCursor(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, setCursor]);

  useEffect(() => {
    void load(activeLabel, activeTab, unreadOnly);
    const handler = () => void load(activeLabel, activeTab, unreadOnly);
    window.addEventListener("laim:refresh-threads", handler);
    return () => window.removeEventListener("laim:refresh-threads", handler);
  }, [load, activeLabel, activeTab, unreadOnly]);

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

  const displayed = threads;

  return (
    <div className="divide-y divide-neutral-100">
      {/* Tab bar — only for Inbox */}
      {isInbox && (
        <div className="flex items-center border-b border-neutral-200 bg-white">
          {INBOX_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "text-blue-600" : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
          {/* Unread toggle */}
          <div className="ml-auto flex items-center gap-2 pr-3">
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                unreadOnly
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${unreadOnly ? "bg-blue-500" : "bg-neutral-300"}`} />
              Unread
            </button>
          </div>
        </div>
      )}

      {/* Non-inbox header with unread toggle */}
      {!isInbox && (
        <div className="flex items-center justify-end border-b border-neutral-200 bg-white px-4 py-2">
          <button
            onClick={() => setUnreadOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              unreadOnly
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${unreadOnly ? "bg-blue-500" : "bg-neutral-300"}`} />
            Unread only
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && displayed.length === 0 && (
        <div className="space-y-px">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="h-2 w-2 rounded-full bg-neutral-100" />
              <div className="h-3 w-36 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 flex-1 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-10 animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      )}

      {/* Thread rows */}
      {displayed.map((t, i) => (
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

      {displayed.length === 0 && !loading && (
        <div className="p-10 text-center text-sm text-neutral-400">
          {unreadOnly ? "No unread messages here." : "Nothing here."}
        </div>
      )}
    </div>
  );
}
