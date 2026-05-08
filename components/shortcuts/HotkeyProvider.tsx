"use client";

import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useActions } from "./ActionContext";
import { useApp } from "@/lib/store";

const opts = { enableOnFormTags: false, preventDefault: true } as const;

function useSequence(
  first: string,
  second: string,
  callback: () => void,
  blocked: boolean,
) {
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (blocked) { pending.current = false; return; }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      if (pending.current && e.key.toLowerCase() === second.toLowerCase()) {
        e.preventDefault();
        pending.current = false;
        if (timer.current) clearTimeout(timer.current);
        callback();
        return;
      }
      if (e.key.toLowerCase() === first.toLowerCase()) {
        e.preventDefault();
        pending.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => { pending.current = false; }, 1000);
      } else {
        pending.current = false;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [first, second, callback, blocked]);
}

export function HotkeyProvider() {
  const { dispatch } = useActions();
  const composerOpen = useApp((s) => s.composerOpen);
  const paletteOpen = useApp((s) => s.paletteOpen);
  const blocked = composerOpen || paletteOpen;

  useHotkeys("j", () => !blocked && dispatch("next"), opts, [blocked, dispatch]);
  useHotkeys("k", () => !blocked && dispatch("prev"), opts, [blocked, dispatch]);
  useHotkeys("enter,o", () => !blocked && dispatch("open"), opts, [blocked, dispatch]);
  useHotkeys("u", () => !blocked && dispatch("back"), opts, [blocked, dispatch]);
  useHotkeys("e", () => !blocked && dispatch("archive"), opts, [blocked, dispatch]);
  useHotkeys("s", () => !blocked && dispatch("star"), opts, [blocked, dispatch]);
  useHotkeys("shift+u", () => !blocked && dispatch("markUnread"), opts, [blocked, dispatch]);
  useHotkeys("r", () => !blocked && dispatch("reply"), opts, [blocked, dispatch]);
  useHotkeys("a", () => !blocked && dispatch("replyAll"), opts, [blocked, dispatch]);
  useHotkeys("f", () => !blocked && dispatch("forward"), opts, [blocked, dispatch]);
  useHotkeys("c", () => !blocked && dispatch("compose"), opts, [blocked, dispatch]);
  useHotkeys("[", () => !blocked && dispatch("prevAccount"), opts, [blocked, dispatch]);
  useHotkeys("]", () => !blocked && dispatch("nextAccount"), opts, [blocked, dispatch]);
  useHotkeys("mod+k", () => dispatch("palette"), { ...opts, enableOnFormTags: true, enableOnContentEditable: true }, [dispatch]);
  useHotkeys("escape", () => {
    if (useApp.getState().paletteOpen) useApp.getState().closePalette();
    else if (useApp.getState().composerOpen) useApp.getState().closeComposer();
  }, { enableOnFormTags: true, enableOnContentEditable: true });

  useSequence("g", "i", () => !blocked && dispatch("goInbox"), blocked);
  useSequence("g", "d", () => !blocked && dispatch("goDashboard"), blocked);

  return null;
}
