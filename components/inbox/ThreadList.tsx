"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  participants: string[];
  messageCount: number;
  spamScore: number | null;
  hasUnsubscribe: boolean;
  hasAttachment: boolean;
}

interface ThreadGroup {
  key: string;
  senderName: string;
  threads: Thread[];
  unreadCount: number;
  mostRecentDate: string;
  latestSubject: string;
  latestSnippet: string;
  totalMessageCount: number;
  hasAttachment: boolean;
  isBulk: boolean;
  hasReplied: boolean;
}

type Tab = "primary" | "promotions" | "updates" | "social" | "forums";

const INBOX_TABS: { id: Tab; label: string; labelIds: string[] }[] = [
  { id: "primary",    label: "Primary",    labelIds: ["INBOX", "CATEGORY_PERSONAL"] },
  { id: "promotions", label: "Promotions", labelIds: ["CATEGORY_PROMOTIONS"] },
  { id: "updates",    label: "Updates",    labelIds: ["CATEGORY_UPDATES"] },
  { id: "social",     label: "Social",     labelIds: ["CATEGORY_SOCIAL"] },
  { id: "forums",     label: "Forums",     labelIds: ["CATEGORY_FORUMS"] },
];

function parseSender(raw: string): { name: string; email: string } {
  const m = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim().toLowerCase() };
  return { name: raw.trim(), email: raw.trim().toLowerCase() };
}

function avatarColor(email: string): string {
  const colors = ["bg-blue-500","bg-violet-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-cyan-500","bg-indigo-500","bg-pink-500","bg-teal-500"];
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

function initials(name: string): string {
  const p = name.split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtRelative(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return fmtDate(raw);
}

function fmtParticipants(participants: string[], messageCount: number): string {
  const str = participants.join(", ");
  return messageCount > 1 ? `${str} ${messageCount}` : str;
}

function groupThreads(threads: Thread[]): ThreadGroup[] {
  const map = new Map<string, ThreadGroup>();
  for (const t of threads) {
    const { name, email } = parseSender(t.from);
    if (!map.has(email)) {
      map.set(email, {
        key: email,
        senderName: name,
        threads: [],
        unreadCount: 0,
        mostRecentDate: t.date,
        latestSubject: t.subject,
        latestSnippet: t.snippet,
        totalMessageCount: 0,
        hasAttachment: false,
        isBulk: false,
        hasReplied: false,
      });
    }
    const g = map.get(email)!;
    g.threads.push(t);
    if (t.unread) g.unreadCount++;
    g.totalMessageCount += t.messageCount ?? 1;
    if (t.hasAttachment) g.hasAttachment = true;
    if (t.hasUnsubscribe) g.isBulk = true;
    if (t.participants?.includes("me")) g.hasReplied = true;
    if (new Date(t.date) > new Date(g.mostRecentDate)) {
      g.mostRecentDate = t.date;
      g.latestSubject = t.subject;
      g.latestSnippet = t.snippet;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.mostRecentDate).getTime() - new Date(a.mostRecentDate).getTime()
  );
}

interface CtxMenu { x: number; y: number; thread: Thread }

async function apiAction(threadId: string, accountId: string, action: string, extra?: Record<string, unknown>) {
  await fetch(`/api/gmail/threads/${threadId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accountId, action, ...extra }),
  });
  window.dispatchEvent(new CustomEvent("laim:refresh-threads"));
}

function ContextMenu({ menu, accountId, onClose }: { menu: CtxMenu; accountId: string; onClose: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) { if (e.key === "Escape") onClose(); return; }
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", handler); };
  }, [onClose]);

  // Flip menu if it would go off the bottom of viewport
  const top = Math.min(menu.y, window.innerHeight - 180);
  const left = Math.min(menu.x, window.innerWidth - 180);

  const items = [
    {
      label: menu.thread.unread ? "Mark as read" : "Mark as unread",
      icon: "●",
      action: async () => {
        await apiAction(menu.thread.id, accountId, "markRead", { read: menu.thread.unread });
        onClose();
      },
    },
    {
      label: menu.thread.starred ? "Unstar" : "Star",
      icon: "★",
      action: async () => {
        await apiAction(menu.thread.id, accountId, "star", { starred: !menu.thread.starred });
        onClose();
      },
    },
    {
      label: "Archive",
      icon: "↓",
      action: async () => {
        await apiAction(menu.thread.id, accountId, "archive");
        onClose();
      },
    },
  ];

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top, left, zIndex: 9999 }}
      className="min-w-[160px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <span className="w-4 text-center text-xs text-neutral-400 dark:text-neutral-500">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SpamBadge({ score, hasUnsubscribe }: { score: number | null; hasUnsubscribe: boolean }) {
  const chips: React.ReactNode[] = [];
  if (score !== null) {
    const color = score >= 4 ? "bg-red-100 text-red-600" : score >= 2 ? "bg-amber-100 text-amber-600" : score >= 0 ? "bg-yellow-50 text-yellow-600" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500";
    chips.push(
      <span key="score" className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${color}`} title="Spam score">
        {score > 0 ? "+" : ""}{score.toFixed(1)}
      </span>
    );
  }
  if (hasUnsubscribe) {
    chips.push(
      <span key="unsub" className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500" title="Has unsubscribe link">
        bulk
      </span>
    );
  }
  if (chips.length === 0) return null;
  return <span className="flex shrink-0 items-center gap-1">{chips}</span>;
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
          : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"}`} />
      {label}
    </button>
  );
}

interface GroupCtxMenu { x: number; y: number; group: ThreadGroup }

function GroupRow({ group, accountId, cursor, flatIndex, onOpen }: {
  group: ThreadGroup;
  accountId: string;
  cursor: number;
  flatIndex: number;
  onOpen: (threadId: string, idx: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [groupCtx, setGroupCtx] = useState<GroupCtxMenu | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const ctxRef = React.useRef<HTMLDivElement>(null);
  const color = avatarColor(group.key);
  const ini = initials(group.senderName);
  const hasUnread = group.unreadCount > 0;

  useEffect(() => {
    if (!groupCtx) return;
    function handler(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) { if (e.key === "Escape") setGroupCtx(null); return; }
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setGroupCtx(null);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", handler); };
  }, [groupCtx]);

  async function markAllRead() {
    setMarkingRead(true);
    await Promise.all(
      group.threads.filter((t) => t.unread).map((t) =>
        fetch(`/api/gmail/threads/${t.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accountId, action: "markRead", read: true }),
        })
      )
    );
    window.dispatchEvent(new CustomEvent("laim:refresh-threads"));
    setMarkingRead(false);
    setGroupCtx(null);
  }

  async function archiveAll() {
    await Promise.all(
      group.threads.map((t) =>
        fetch(`/api/gmail/threads/${t.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accountId, action: "archive" }),
        })
      )
    );
    window.dispatchEvent(new CustomEvent("laim:refresh-threads"));
    setGroupCtx(null);
  }

  return (
    <div className="relative border-b border-neutral-100 last:border-0 dark:border-neutral-800">
      {/* Group header */}
      <button
        onClick={() => setOpen((o) => !o)}
        onContextMenu={(e) => { e.preventDefault(); setGroupCtx({ x: e.clientX, y: e.clientY, group }); }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}>
          {ini}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className={`truncate text-sm font-semibold ${hasUnread ? "text-neutral-900 dark:text-white" : "text-neutral-700 dark:text-neutral-200"}`}>
                {group.senderName}
              </span>
              {hasUnread && (
                <span className="shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {group.unreadCount}
                </span>
              )}
            </div>
            <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">{fmtDate(group.mostRecentDate)}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
              {group.threads.length} {group.threads.length === 1 ? "thread" : "threads"}
              {group.totalMessageCount > group.threads.length && (
                <> · {group.totalMessageCount} messages</>
              )}
              {" · "}{fmtRelative(group.mostRecentDate)}
            </span>
            {group.hasAttachment && (
              <svg className="h-3 w-3 shrink-0 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <title>Has attachments</title>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
            {group.isBulk && (
              <span className="shrink-0 rounded bg-neutral-200 px-1 py-px text-[10px] text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400">bulk</span>
            )}
            {group.hasReplied && (
              <svg className="h-3 w-3 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <title>You&apos;ve replied</title>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            )}
            {!open && (
              <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                · {group.latestSubject || group.latestSnippet}
              </span>
            )}
          </div>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform dark:text-neutral-500 ${open ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Group right-click context menu */}
      {groupCtx && (
        <div
          ref={ctxRef}
          style={{ position: "fixed", top: Math.min(groupCtx.y, window.innerHeight - 100), left: Math.min(groupCtx.x, window.innerWidth - 200), zIndex: 9999 }}
          className="min-w-[180px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          <button
            onClick={markAllRead}
            disabled={markingRead || !hasUnread}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            {markingRead ? "Marking…" : "Mark all as read"}
            {hasUnread && <span className="ml-auto text-xs text-neutral-400">{group.unreadCount}</span>}
          </button>
          <button
            onClick={archiveAll}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <svg className="h-3.5 w-3.5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8m-9 4v4m4-4v4" />
            </svg>
            Archive all
            <span className="ml-auto text-xs text-neutral-400">{group.threads.length}</span>
          </button>
        </div>
      )}

      {/* Expanded thread list */}
      {open && (
        <div className="border-t border-neutral-100 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/50">
          {group.threads.map((t, i) => {
            const idx = flatIndex + i;
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t.id, idx)}
                onMouseEnter={() => useApp.getState().setCursor(idx)}
                className={`flex w-full items-center gap-3 px-4 py-2 pl-14 text-left text-sm transition-colors ${
                  idx === cursor ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-white dark:hover:bg-neutral-800"
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.unread ? "bg-blue-500" : "bg-neutral-300"}`} />
                <span className="min-w-0 flex-1 truncate">
                  <span className={t.unread ? "font-semibold text-neutral-900 dark:text-white" : "text-neutral-700 dark:text-neutral-200"}>
                    {t.subject || "(no subject)"}
                  </span>
                  <span className="ml-2 text-neutral-400 dark:text-neutral-500">{t.snippet}</span>
                </span>
                {t.starred && <span className="shrink-0 text-amber-400">★</span>}
                {t.messageCount > 1 && (
                  <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">{t.messageCount}</span>
                )}
                <span className="w-14 shrink-0 text-right font-mono text-xs text-neutral-400 dark:text-neutral-500">{fmtDate(t.date)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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

  const grouped = useApp((s) => s.inboxGrouped);
  const setGrouped = useApp((s) => s.setInboxGrouped);
  const [activeTab, setActiveTab] = useState<Tab>("primary");
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [dateRange, setDateRange] = useState<"90d" | "6m" | "1y" | "all">("90d");
  const [hasAttachmentOnly, setHasAttachmentOnly] = useState(false);
  const [hideBulk, setHideBulk] = useState(false);
  const [repliedOnly, setRepliedOnly] = useState(false);
  const [hideHighSpam, setHideHighSpam] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = React.useRef<HTMLDivElement>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  // Close filters dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buildParams = useCallback((label: string, tab: Tab, unread: boolean, range: "90d" | "6m" | "1y" | "all") => {
    const labelIds = label === "INBOX"
      ? INBOX_TABS.find((t) => t.id === tab)!.labelIds
      : [label];
    const maxResults = range === "90d" ? 50 : range === "6m" ? 100 : 200;
    const params = new URLSearchParams({ accountId: accountId!, max: String(maxResults), label: labelIds.join(",") });
    const daysBack = range === "90d" ? 90 : range === "6m" ? 182 : range === "1y" ? 365 : 0;
    const afterClause = daysBack > 0
      ? `after:${new Date(Date.now() - daysBack * 86400_000).toISOString().slice(0, 10).replace(/-/g, "/")}`
      : "";
    const q = [label !== "SPAM" ? "-in:spam" : "", unread ? "is:unread" : "", afterClause].filter(Boolean).join(" ");
    if (q) params.set("q", q);
    return params;
  }, [accountId]);

  const load = useCallback(async (label: string, tab: Tab, unread: boolean, range: "90d" | "6m" | "1y" | "all") => {
    if (!accountId) return;
    setLoading(true);
    try {
      const params = buildParams(label, tab, unread, range);
      const res = await fetch(`/api/gmail/threads?${params}`);
      const data = await res.json();
      setThreads(data.threads ?? []);
      setNextPageToken(data.nextPageToken ?? null);
      setCursor(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, buildParams, setCursor]);

  const loadMore = useCallback(async () => {
    if (!accountId || !nextPageToken) return;
    setLoadingMore(true);
    try {
      const params = buildParams(activeLabel, activeTab, unreadOnly, dateRange);
      params.set("pageToken", nextPageToken);
      const res = await fetch(`/api/gmail/threads?${params}`);
      const data = await res.json();
      setThreads((prev) => [...prev, ...(data.threads ?? [])]);
      setNextPageToken(data.nextPageToken ?? null);
    } finally {
      setLoadingMore(false);
    }
  }, [accountId, nextPageToken, buildParams, activeLabel, activeTab, unreadOnly, dateRange]);

  useEffect(() => {
    void load(activeLabel, activeTab, unreadOnly, dateRange);
    const handler = () => void load(activeLabel, activeTab, unreadOnly, dateRange);
    window.addEventListener("laim:refresh-threads", handler);
    return () => window.removeEventListener("laim:refresh-threads", handler);
  }, [load, activeLabel, activeTab, unreadOnly, dateRange]);

  useEffect(() => {
    if (!accountId) return;
    const list = threads.map((t) => ({ id: t.id, accountId }));
    registerThreadList(list);
    useApp.getState().setThreadList(list);
  }, [threads, accountId, registerThreadList]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setThreads([]);
    setNextPageToken(null);
    setCursor(0);
  }

  function openThread(threadId: string, idx: number) {
    setCursor(idx);
    router.push(`/thread/${threadId}?accountId=${accountId}`);
  }

  if (!accountId) return <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">No active account.</div>;

  const filteredThreads = threads
    .filter((t) => !hasAttachmentOnly || t.hasAttachment)
    .filter((t) => !hideBulk || !t.hasUnsubscribe)
    .filter((t) => !repliedOnly || t.participants?.includes("me"))
    .filter((t) => !hideHighSpam || (t.spamScore ?? 0) < 4);
  const groups = grouped ? groupThreads(filteredThreads) : [];
  const unreadCount = threads.filter((t) => t.unread).length;
  const attachmentCount = threads.filter((t) => t.hasAttachment).length;
  const repliedCount = threads.filter((t) => t.participants?.includes("me")).length;
  const extraActive = hasAttachmentOnly || hideBulk || repliedOnly || hideHighSpam;

  const Toggles = () => (
    <div className="flex items-center gap-2">
      <Toggle active={grouped} onClick={() => setGrouped(!grouped)} label="Grouped" />

      {/* Date range segmented control */}
      <div className="flex overflow-hidden rounded-full border border-neutral-200 text-xs font-medium dark:border-neutral-700">
        {(["90d", "6m", "1y", "all"] as const).map((range) => (
          <button
            key={range}
            onClick={() => {
              setDateRange(range);
              // Wider ranges are useless with unread-only — older emails are already read
              if (range !== "90d") setUnreadOnly(false);
            }}
            className={`px-3 py-1 transition-colors ${
              dateRange === range
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {range === "90d" ? "90d" : range === "6m" ? "6mo" : range === "1y" ? "1yr" : "All"}
            {dateRange === range && nextPageToken && <span className="ml-0.5 opacity-60">+</span>}
          </button>
        ))}
      </div>

      <button
        onClick={() => setUnreadOnly((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          unreadOnly
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
            : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-200"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${unreadOnly ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"}`} />
        Unread only
        <span className={`ml-0.5 tabular-nums ${
          unreadCount === 0 ? "text-neutral-300 dark:text-neutral-600"
          : unreadOnly ? "text-blue-500"
          : "text-neutral-400 dark:text-neutral-500"
        }`}>
          {unreadCount}
        </span>
      </button>

      {/* Extra filters dropdown */}
      <div className="relative" ref={filtersRef}>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            extraActive
              ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
              : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-200"
          }`}
        >
          {extraActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
          Filters
          <svg className={`h-3 w-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {filtersOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 min-w-[170px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {/* Attachments */}
            <button
              onClick={() => setHasAttachmentOnly((v) => !v)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                hasAttachmentOnly ? "text-blue-700 dark:text-blue-300" : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Has attachment
              <span className={`ml-auto tabular-nums ${attachmentCount === 0 ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-400 dark:text-neutral-500"}`}>
                {attachmentCount}
              </span>
              {hasAttachmentOnly && <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
            </button>

            {/* Hide bulk */}
            <button
              onClick={() => setHideBulk((v) => !v)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                hideBulk ? "text-blue-700 dark:text-blue-300" : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Hide bulk
              {hideBulk && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
            </button>

            {/* Replied */}
            <button
              onClick={() => setRepliedOnly((v) => !v)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                repliedOnly ? "text-blue-700 dark:text-blue-300" : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Replied
              <span className={`ml-auto tabular-nums ${repliedCount === 0 ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-400 dark:text-neutral-500"}`}>
                {repliedCount}
              </span>
              {repliedOnly && <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
            </button>

            {/* Hide high spam */}
            <button
              onClick={() => setHideHighSpam((v) => !v)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                hideHighSpam ? "text-blue-700 dark:text-blue-300" : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              Hide high spam
              {hideHighSpam && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
      {/* Tab bar */}
      {isInbox ? (
        <div className="flex items-center border-b border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          {INBOX_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "text-blue-600 dark:text-blue-400" : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pr-3">
            <Toggles />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2 border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-700 dark:bg-neutral-900">
          <Toggles />
        </div>
      )}

      {/* More-results banner */}
      {!loading && nextPageToken && (
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
          <span>Showing {threads.length} threads — more exist beyond this limit.</span>
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="ml-4 rounded px-2 py-0.5 font-medium underline-offset-2 hover:underline disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && threads.length === 0 && (
        <div className="space-y-px">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="h-2 w-2 rounded-full bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-3 w-36 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-3 flex-1 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-3 w-10 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
            </div>
          ))}
        </div>
      )}

      {/* Grouped view */}
      {grouped && !loading && (
        groups.length === 0
          ? <div className="p-10 text-center text-sm text-neutral-400 dark:text-neutral-500">Nothing here.</div>
          : <div>
              {(() => {
                let offset = 0;
                return groups.map((g) => {
                  const idx = offset;
                  offset += g.threads.length;
                  return (
                    <GroupRow
                      key={g.key}
                      group={g}
                      accountId={accountId}
                      cursor={cursor}
                      flatIndex={idx}
                      onOpen={openThread}
                    />
                  );
                });
              })()}
            </div>
      )}

      {/* Flat view */}
      {ctxMenu && accountId && (
        <ContextMenu menu={ctxMenu} accountId={accountId} onClose={() => setCtxMenu(null)} />
      )}

      {!grouped && filteredThreads.map((t, i) => (
        <button
          key={t.id}
          onClick={() => openThread(t.id, i)}
          onMouseEnter={() => setCursor(i)}
          onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, thread: t }); }}
          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
            i === cursor ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
          }`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${t.unread ? "bg-blue-500" : "bg-transparent"}`} />
          <span className="w-44 shrink-0 truncate font-medium text-neutral-900 dark:text-white">
            {fmtParticipants(t.participants?.length ? t.participants : [t.from], t.messageCount ?? 1)}
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span className={t.unread ? "font-semibold text-neutral-900 dark:text-white" : "text-neutral-700 dark:text-neutral-200"}>
              {t.subject || "(no subject)"}
            </span>
            <span className="ml-2 text-neutral-400 dark:text-neutral-500">{t.snippet}</span>
          </span>
          <SpamBadge score={t.spamScore ?? null} hasUnsubscribe={t.hasUnsubscribe ?? false} />
          {t.starred && <span className="shrink-0 text-amber-400">★</span>}
          <span className="w-16 shrink-0 text-right font-mono text-xs text-neutral-400 dark:text-neutral-500">{fmtDate(t.date)}</span>
        </button>
      ))}

      {!grouped && filteredThreads.length === 0 && !loading && (
        <div className="p-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
          {unreadOnly ? "No unread messages here." : "Nothing here."}
        </div>
      )}
    </div>
  );
}
