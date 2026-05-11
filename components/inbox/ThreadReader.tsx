"use client";

import { useEffect, useState } from "react";
import { useActions } from "@/components/shortcuts/ActionContext";
import { useApp } from "@/lib/store";
import { SenderHistory } from "./SenderHistory";

interface Message {
  id: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  spamScore: number | null;
  unsubscribeUrl: string | null;
}

interface ThreadFull {
  id: string;
  subject: string;
  messages: Message[];
}

function parseSender(raw: string): { name: string; email: string } {
  const m = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim() };
  return { name: raw.trim(), email: raw.trim() };
}

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(email: string): string {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500",
    "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-indigo-500",
  ];
  let hash = 0;
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function fmtDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sanitizeHtml(raw: string): string {
  // Extract body content if full HTML document
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : raw;
  // Strip scripts and on* event handlers
  return content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function HtmlEmailBody({ html }: { html: string }) {
  const clean = sanitizeHtml(html);
  return (
    <div
      className="email-body prose max-w-none text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function MessageCard({ m, defaultOpen }: { m: Message; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const sender = parseSender(m.from);
  const color = avatarColor(sender.email);

  return (
    <article className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${color}`}>
          {initials(sender.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{sender.name}</span>
            <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">{fmtDate(m.date)}</span>
          </div>
          {!open && (
            <p className="truncate text-xs text-neutral-400 dark:text-neutral-500">{m.bodyText.slice(0, 120)}</p>
          )}
          {open && (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{sender.email}</p>
              {m.spamScore !== null && (
                <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                  m.spamScore >= 4 ? "bg-red-100 text-red-600" :
                  m.spamScore >= 2 ? "bg-amber-100 text-amber-600" :
                  m.spamScore >= 0 ? "bg-yellow-50 text-yellow-600" :
                  "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
                }`} title="Spam score (higher = more suspicious)">
                  spam {m.spamScore > 0 ? "+" : ""}{m.spamScore.toFixed(1)}
                </span>
              )}
              {m.unsubscribeUrl && (
                <a
                  href={m.unsubscribeUrl}
                  target={m.unsubscribeUrl.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 underline hover:text-red-500 transition-colors dark:text-neutral-500"
                >
                  Unsubscribe
                </a>
              )}
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-neutral-100 px-4 pb-1 pt-3 dark:border-neutral-800">
          {m.to && (
            <p className="mb-3 text-xs text-neutral-400 dark:text-neutral-500">
              <span className="font-medium text-neutral-500 dark:text-neutral-400">To: </span>{m.to}
              {m.cc && <><span className="ml-2 font-medium text-neutral-500 dark:text-neutral-400">Cc: </span>{m.cc}</>}
            </p>
          )}
          {m.bodyHtml ? (
            <HtmlEmailBody html={m.bodyHtml} />
          ) : (
            <div className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-neutral-800 pb-3 dark:text-neutral-200">
              {m.bodyText}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function ThreadReader({ threadId, accountId }: { threadId: string; accountId: string }) {
  const [data, setData] = useState<ThreadFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRead, setIsRead] = useState(true);
  const { registerOpenThread, dispatch } = useActions();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/gmail/threads/${threadId}?accountId=${accountId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.thread);
        setIsRead(true);
        // Mark as read silently — fire and forget, same as Gmail
        fetch(`/api/gmail/threads/${threadId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accountId, action: "markRead", read: true }),
        }).then(() => {
          window.dispatchEvent(new CustomEvent("laim:refresh-threads"));
        });
      })
      .finally(() => setLoading(false));
  }, [threadId, accountId]);

  useEffect(() => {
    if (!data) return;
    const last = data.messages[data.messages.length - 1];
    registerOpenThread({
      id: data.id,
      accountId,
      lastMessageId: last?.id,
      subject: data.subject,
      from: last?.from,
      to: last?.to,
      cc: last?.cc,
    });
    return () => registerOpenThread(undefined);
  }, [data, accountId, registerOpenThread]);

  if (loading) {
    return (
      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          ))}
        </div>
        <div className="w-52 xl:w-[420px] shrink-0 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">Thread not found.</div>;

  const lastMessage = data.messages[data.messages.length - 1];
  const senderEmail = parseSender(lastMessage?.from ?? "").email;

  return (
    <div className="flex gap-6 items-start">
      {/* Main thread */}
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            title="Back (u)"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="truncate text-lg font-semibold text-neutral-900 dark:text-white">
            {data.subject || "(no subject)"}
          </h1>
          {data.messages.length > 1 && (
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {data.messages.length}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {data.messages.map((m, i) => (
            <MessageCard
              key={m.id}
              m={m}
              defaultOpen={i === data.messages.length - 1}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => dispatch("reply")}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            Reply <kbd className="ml-1 rounded bg-neutral-100 px-1 font-mono text-[10px] text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">r</kbd>
          </button>
          <button
            onClick={() => dispatch("replyAll")}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Reply all <kbd className="ml-1 rounded bg-neutral-100 px-1 font-mono text-[10px] text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">a</kbd>
          </button>
          <button
            onClick={() => dispatch("forward")}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" /></svg>
            Forward <kbd className="ml-1 rounded bg-neutral-100 px-1 font-mono text-[10px] text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">f</kbd>
          </button>
          <button
            onClick={() => dispatch("archive")}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8m-9 4v4m4-4v4" /></svg>
            Archive <kbd className="ml-1 rounded bg-neutral-100 px-1 font-mono text-[10px] text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">e</kbd>
          </button>
          <button
            onClick={async () => {
              const newRead = !isRead;
              setIsRead(newRead);
              await fetch(`/api/gmail/threads/${threadId}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ accountId, action: "markRead", read: newRead }),
              });
              window.dispatchEvent(new CustomEvent("laim:refresh-threads"));
            }}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <span className={`h-2 w-2 rounded-full ${isRead ? "bg-neutral-300" : "bg-blue-500"}`} />
            {isRead ? "Mark unread" : "Mark read"}
            <kbd className="ml-1 rounded bg-neutral-100 px-1 font-mono text-[10px] text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">U</kbd>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-52 xl:w-[420px] shrink-0 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm max-h-[calc(100vh-80px)] overflow-y-auto sticky top-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          From this sender
        </h2>
        <SenderHistory
          senderEmail={senderEmail}
          accountId={accountId}
          currentThreadId={threadId}
        />
      </aside>
    </div>
  );
}
