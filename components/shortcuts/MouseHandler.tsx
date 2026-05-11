"use client";

import { useEffect } from "react";
import { useActions } from "./ActionContext";
import { useApp } from "@/lib/store";
import type { ActionId } from "./actions";

// Default MX4 side-button → action mapping. button 3 = back thumb, 4 = forward thumb.
const DEFAULT_MAP: Record<number, ActionId> = {
  3: "prev",
  4: "next",
};

export function MouseHandler() {
  const { dispatch } = useActions();

  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      const actionId = DEFAULT_MAP[e.button];
      if (!actionId) return;

      const state = useApp.getState();
      if (state.composerOpen || state.paletteOpen) return;

      e.preventDefault();
      e.stopPropagation();

      // Shift+button → archive instead of navigate
      if (e.shiftKey) {
        dispatch("archive");
      } else {
        dispatch(actionId);
      }
    }

    // auxclick fires on middle/extra buttons in some browsers; mouseup is more reliable
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [dispatch]);

  return null;
}
