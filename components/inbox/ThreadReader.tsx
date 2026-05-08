"use client";

import { useEffect, useRef, useState } from "react";
import { useActions } from "@/components/shortcuts/ActionContext";
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

function HtmlEmailBody({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a; word-wrap: break-word; }
    img { max-width: 100%; height: auto; }
    a { color: #2563eb; }
    table { max-width: 100%; }
    pre, code { white-space: pre-wrap; word-break: break-all; }
  </style></head><body>${html}</body></html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      className="w-full border-0"
      style={{ height }}
      onLoad={() => {
        const doc = iframeRef.current?.contentDocument;
        if (doc) setHeight(doc.documentElement.scrollHeight + 16);
      }}
    />
  );
}

function MessageCard({ m, defaultOpen }: { m: Message; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const sender = parseSender(m.from);
  const color = avatarColor(sender.email);

  return (
    <article className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${color}`}>
          {initials(sender.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-neutral-900">{sender.name}</span>
            <span className="shrink-0 text-xs text-neutral-400">{fmtDate(m.date)}</span>
          </div>
          {!open && (
            <p className="truncate text-xs text-neutral-400">{m.bodyText.slice(0, 120)}</p>
          )}
          {open && (
            <p className="text-xs text-neutral-500">{sender.email}</p>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-neutral-100 px-4 pb-1 pt-3">
          {m.to && (
            <p className="mb-3 text-xs text-neutral-400">
              <span className="font-medium text-neutral-500">To: </span>{m.to}
              {m.cc && <><span className="ml-2 font-medium text-neutral-500">Cc: </span>{m.cc}</>}
            </p>
          )}
          {m.bodyHtml ? (
            <HtmlEmailBody html={m.bodyHtml} />
          ) : (
            <div className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-neutral-800 pb-3">
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
  const { registerOpenThread } = useActions();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/gmail/threads/${threadId}?accountId=${accountId}`)
      .then((r) => r.json())
      .then((d) => setData(d.thread))
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
            <div key={i} className="h-32 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
        <div className="w-64 shrink-0 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-6 text-sm text-neutral-500">Thread not found.</div>;

  const lastMessage = data.messages[data.messages.length - 1];
  const senderEmail = parseSender(lastMessage?.from ?? "").email;

  return (
    <div className="flex gap-6 items-start">
      {/* Main thread */}
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            title="Back (u)"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="truncate text-lg font-semibold text-neutral-900">
            {data.subject || "(no subject)"}
          </h1>
          {data.messages.length > 1 && (
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
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

        <div className="mt-4 flex items-center gap-3 text-xs text-neutral-400">
          {[
            { key: "r", label: "Reply" },
            { key: "a", label: "Reply all" },
            { key: "f", label: "Forward" },
            { key: "e", label: "Archive" },
            { key: "u", label: "Back" },
          ].map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1">
              <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">{key}</kbd>
              <span>{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-60 shrink-0 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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
