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

// Throttle horizontal scroll so one flick = one action
let lastWheelTime = 0;
const WHEEL_THROTTLE_MS = 300;

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

    function onWheel(e: WheelEvent) {
      // Only handle horizontal scroll with meaningful delta; ignore vertical
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (Math.abs(e.deltaX) < 10) return;

      const state = useApp.getState();
      if (state.composerOpen || state.paletteOpen) return;

      const now = Date.now();
      if (now - lastWheelTime < WHEEL_THROTTLE_MS) return;
      lastWheelTime = now;

      e.preventDefault();
      dispatch(e.deltaX > 0 ? "next" : "prev");
    }

    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("wheel", onWheel);
    };
  }, [dispatch]);

  return null;
}
