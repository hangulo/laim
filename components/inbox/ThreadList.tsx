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

function GroupRow({ group, accountId, cursor, flatIndex, onOpen }: {
  group: ThreadGroup;
  accountId: string;
  cursor: number;
  flatIndex: number;
  onOpen: (threadId: string, idx: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const color = avatarColor(group.key);
  const ini = initials(group.senderName);
  const hasUnread = group.unreadCount > 0;

  return (
    <div className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
      {/* Group header */}
      <button
        onClick={() => setOpen((o) => !o)}
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
              <span className="shrink-0 rounded bg-neutral-100 px-1 py-px text-[10px] text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">bulk</span>
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

  const [activeTab, setActiveTab] = useState<Tab>("primary");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [hasAttachmentOnly, setHasAttachmentOnly] = useState(false);
  const [hideBulk, setHideBulk] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const load = useCallback(async (label: string, tab: Tab, unread: boolean) => {
    if (!accountId) return;
    setLoading(true);
    try {
      const labelIds = label === "INBOX"
        ? INBOX_TABS.find((t) => t.id === tab)!.labelIds
        : [label];
      const params = new URLSearchParams({ accountId, max: "50", label: labelIds.join(",") });
      // Always exclude spam from category views; combine with unread filter if needed
      const q = [label !== "SPAM" ? "-in:spam" : "", unread ? "is:unread" : ""].filter(Boolean).join(" ");
      if (q) params.set("q", q);
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

  function openThread(threadId: string, idx: number) {
    setCursor(idx);
    router.push(`/thread/${threadId}?accountId=${accountId}`);
  }

  if (!accountId) return <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">No active account.</div>;

  const filteredThreads = threads
    .filter((t) => !hasAttachmentOnly || t.hasAttachment)
    .filter((t) => !hideBulk || !t.hasUnsubscribe);
  const groups = grouped ? groupThreads(filteredThreads) : [];
  const unreadCount = threads.filter((t) => t.unread).length;
  const attachmentCount = threads.filter((t) => t.hasAttachment).length;

  const Toggles = () => (
    <div className="flex items-center gap-2">
      <Toggle active={grouped} onClick={() => setGrouped((v) => !v)} label="Grouped" />
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
          unreadCount === 0
            ? "text-neutral-300 dark:text-neutral-600"
            : unreadOnly
              ? "text-blue-500"
              : "text-neutral-400 dark:text-neutral-500"
        }`}>
          {unreadCount}
        </span>
      </button>
      <button
        onClick={() => setHasAttachmentOnly((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          hasAttachmentOnly
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
            : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-200"
        }`}
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        Attachments
        <span className={`ml-0.5 tabular-nums ${
          attachmentCount === 0
            ? "text-neutral-300 dark:text-neutral-600"
            : hasAttachmentOnly
              ? "text-blue-500"
              : "text-neutral-400 dark:text-neutral-500"
        }`}>
          {attachmentCount}
        </span>
      </button>
      <Toggle active={hideBulk} onClick={() => setHideBulk((v) => !v)} label="Hide bulk" />
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
