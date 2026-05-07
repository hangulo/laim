"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { useActions } from "./ActionContext";
import { useApp } from "@/lib/store";

const opts = { enableOnFormTags: false, preventDefault: true } as const;

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
  useHotkeys("g+i", () => !blocked && dispatch("goInbox"), opts, [blocked, dispatch]);
  useHotkeys("g+d", () => !blocked && dispatch("goDashboard"), opts, [blocked, dispatch]);
  useHotkeys("[", () => !blocked && dispatch("prevAccount"), opts, [blocked, dispatch]);
  useHotkeys("]", () => !blocked && dispatch("nextAccount"), opts, [blocked, dispatch]);
  useHotkeys("mod+k", () => dispatch("palette"), { ...opts, enableOnFormTags: true, enableOnContentEditable: true }, [
    dispatch,
  ]);
  useHotkeys("escape", () => {
    if (useApp.getState().paletteOpen) useApp.getState().closePalette();
    else if (useApp.getState().composerOpen) useApp.getState().closeComposer();
  }, { enableOnFormTags: true, enableOnContentEditable: true });

  return null;
}
