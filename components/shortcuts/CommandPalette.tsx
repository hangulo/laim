"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { actionList } from "./actions";
import { useActions } from "./ActionContext";

export function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const close = useApp((s) => s.closePalette);
  const { dispatch } = useActions();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return actionList;
    return actionList.filter((a) => a.label.toLowerCase().includes(term) || a.id.toLowerCase().includes(term));
  }, [q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-32" onClick={close}>
      <div
        className="w-[560px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          placeholder="Type a command…"
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const a = filtered[idx];
              if (a) {
                close();
                setTimeout(() => dispatch(a.id), 0);
              }
            }
          }}
          className="w-full border-b border-neutral-200 bg-white px-4 py-3 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
        />
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 && <div className="p-4 text-sm text-neutral-500 dark:text-neutral-400">No matches</div>}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              onClick={() => {
                close();
                setTimeout(() => dispatch(a.id), 0);
              }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm dark:text-neutral-200 ${
                i === idx ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              <span>{a.label}</span>
              {a.hint && <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">{a.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
