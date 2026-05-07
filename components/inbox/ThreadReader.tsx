"use client";

import { useEffect, useState } from "react";
import { useActions } from "@/components/shortcuts/ActionContext";

interface Message {
  id: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  subject: string;
  bodyText: string;
}

interface ThreadFull {
  id: string;
  subject: string;
  messages: Message[];
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

  if (loading) return <div className="p-6 text-sm text-neutral-500">Loading…</div>;
  if (!data) return <div className="p-6 text-sm text-neutral-500">Thread not found.</div>;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">{data.subject || "(no subject)"}</h1>
      <div className="space-y-3">
        {data.messages.map((m) => (
          <article key={m.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <header className="flex items-start justify-between pb-2 text-xs text-neutral-500">
              <div>
                <div className="font-medium text-neutral-900">{m.from}</div>
                <div>to {m.to}{m.cc ? `, cc ${m.cc}` : ""}</div>
              </div>
              <div>{new Date(m.date).toLocaleString()}</div>
            </header>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-neutral-800">
              {m.bodyText}
            </pre>
          </article>
        ))}
      </div>
      <div className="text-xs text-neutral-500">
        <span className="font-mono">r</span> reply ·{" "}
        <span className="font-mono">a</span> reply all ·{" "}
        <span className="font-mono">f</span> forward ·{" "}
        <span className="font-mono">e</span> archive ·{" "}
        <span className="font-mono">u</span> back
      </div>
    </div>
  );
}
