"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface TriageResult {
  id: string;
  threadId: string;
  accountId: string;
  accountEmail: string;
  category: string;
  summary: string;
  urgency: number;
  subject: string;
  fromHeader: string;
  date: string;
  updatedAt: string;
}

function fmtDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function senderName(from: string): string {
  const m = from.match(/^"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : from.split("@")[0];
}

function CategoryBadge({ cat }: { cat: string }) {
  const map: Record<string, string> = {
    action_required: "bg-red-100 text-red-700",
    calendar:        "bg-purple-100 text-purple-700",
    fyi:             "bg-blue-100 text-blue-700",
    newsletter:      "bg-neutral-100 text-neutral-500",
    personal:        "bg-green-100 text-green-700",
  };
  const label: Record<string, string> = {
    action_required: "Action",
    calendar:        "Calendar",
    fyi:             "FYI",
    newsletter:      "Newsletter",
    personal:        "Personal",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${map[cat] ?? "bg-neutral-100 text-neutral-500"}`}>
      {label[cat] ?? cat}
    </span>
  );
}

function ThreadCard({ result, onDone }: { result: TriageResult; onDone: (id: string) => void }) {
  const [archiving, setArchiving] = useState(false);

  async function handleDone(e: React.MouseEvent) {
    e.preventDefault();
    setArchiving(true);
    await fetch(`/api/gmail/threads/${result.threadId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: result.accountId, action: "archive" }),
    });
    onDone(result.id);
  }

  return (
    <div className="group relative rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900">
      <Link href={`/thread/${result.threadId}?accountId=${result.accountId}`} className="block">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-neutral-900 dark:text-white">
            {senderName(result.fromHeader)}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
            {fmtDate(result.date)}
          </span>
        </div>
        <div className="mb-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
          {result.subject || "(no subject)"}
        </div>
        <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 line-clamp-2">
          {result.summary}
        </p>
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <CategoryBadge cat={result.category} />
        {result.urgency >= 2 && (
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
            urgent
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleDone}
          disabled={archiving}
          className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-500"
        >
          {archiving ? "…" : "Done"}
        </button>
      </div>
    </div>
  );
}

export function TriageDashboard() {
  const [results, setResults] = useState<TriageResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [stats, setStats] = useState<{ triaged: number; cached: number } | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/triage/results");
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchResults(); }, [fetchResults]);

  async function runTriage() {
    setRunning(true);
    try {
      const res = await fetch("/api/triage/run", { method: "POST" });
      const data = await res.json();
      setStats({ triaged: data.triaged ?? 0, cached: data.cached ?? 0 });
      setLastRun(new Date());
      await fetchResults();
    } finally {
      setRunning(false);
    }
  }

  function removeCard(id: string) {
    setResults((prev) => prev.filter((r) => r.id !== id));
  }

  const stale = lastRun ? Date.now() - lastRun.getTime() > 3600_000 : true;

  const urgent = results.filter((r) => r.category === "action_required" && r.urgency >= 2);
  const actionCol = results.filter((r) => r.category === "action_required" || r.category === "calendar");
  const infoCol = results.filter((r) => r.category === "fyi" || r.category === "newsletter" || r.category === "personal");

  return (
    <div className="space-y-4">
      {/* Sync strip */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${stale ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20" : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"}`}>
        <span className={`h-2 w-2 rounded-full ${stale ? "bg-amber-400" : "bg-green-500"}`} />
        <span className="flex-1 text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {lastRun
            ? `Triaged ${stats?.triaged ?? 0} new · ${stats?.cached ?? 0} cached · last run ${lastRun.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Run triage to classify your inbox with Claude"}
        </span>
        <button
          onClick={runTriage}
          disabled={running}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {running ? "Triaging…" : "Run triage"}
        </button>
      </div>

      {/* Still needs attention */}
      {urgent.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
            Still needs attention
          </h2>
          <div className="space-y-2">
            {urgent.map((r) => <ThreadCard key={r.id} result={r} onDone={removeCard} />)}
          </div>
        </div>
      )}

      {/* Two columns */}
      {(actionCol.length > 0 || infoCol.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Action · Calendar
            </h2>
            {loading
              ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />)}</div>
              : actionCol.length === 0
                ? <p className="text-xs text-neutral-400">Nothing here.</p>
                : <div className="space-y-2">{actionCol.map((r) => <ThreadCard key={r.id} result={r} onDone={removeCard} />)}</div>
            }
          </section>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              FYI · Newsletter · Personal
            </h2>
            {loading
              ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />)}</div>
              : infoCol.length === 0
                ? <p className="text-xs text-neutral-400">Nothing here.</p>
                : <div className="space-y-2">{infoCol.map((r) => <ThreadCard key={r.id} result={r} onDone={removeCard} />)}</div>
            }
          </section>
        </div>
      )}

      {!loading && results.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No triage results yet — click Run triage above.</p>
      )}
    </div>
  );
}
