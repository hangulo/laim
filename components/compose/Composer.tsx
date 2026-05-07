"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

export function Composer() {
  const open = useApp((s) => s.composerOpen);
  const initial = useApp((s) => s.composerInitial);
  const close = useApp((s) => s.closeComposer);
  const accounts = useApp((s) => s.accounts);
  const activeAccountId = useApp((s) => s.activeAccountId);

  const [accountId, setAccountId] = useState<string>("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAccountId(initial?.accountId ?? activeAccountId ?? accounts[0]?.id ?? "");
    setTo(initial?.to ?? "");
    setCc(initial?.cc ?? "");
    setSubject(initial?.subject ?? "");
    setBody(initial?.bodyText ?? "");
    setError(null);
  }, [open, initial, activeAccountId, accounts]);

  if (!open) return null;

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId,
          to,
          cc: cc || undefined,
          subject,
          bodyText: body,
          threadId: initial?.threadId,
          replyToMessageId: initial?.replyToMessageId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/20 p-6" onClick={close}>
      <div
        className="flex h-[560px] w-[640px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
          <span className="text-xs font-medium text-neutral-700">
            {initial?.threadId ? "Reply" : "New message"}
          </span>
          <button onClick={close} className="text-xs text-neutral-500 hover:text-neutral-900">esc</button>
        </div>
        <div className="flex flex-col gap-2 p-3 text-sm">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>From: {a.email}</option>
            ))}
          </select>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="To"
            className="border-b border-neutral-200 px-1 py-1 outline-none"
          />
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="Cc"
            className="border-b border-neutral-200 px-1 py-1 outline-none"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="border-b border-neutral-200 px-1 py-1 outline-none"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message…"
          className="flex-1 resize-none px-3 py-2 text-sm outline-none"
        />
        {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}
        <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2">
          <span className="font-mono text-xs text-neutral-400">⌘+Enter to send · Esc to close</span>
          <button
            onClick={send}
            disabled={sending || !to || !subject}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
