"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ActionContext as ActionCtx, ActionId } from "./actions";
import { actions } from "./actions";
import { usePathname, useRouter } from "next/navigation";

interface RegistryValue {
  registerThreadList: (list: ActionCtx["threadList"]) => void;
  registerOpenThread: (thread: ActionCtx["openThread"] | undefined) => void;
  dispatch: (id: ActionId) => void;
}

const RegistryContext = createContext<RegistryValue | null>(null);

export function ActionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [threadList, setThreadList] = useState<ActionCtx["threadList"]>([]);
  const [openThread, setOpenThread] = useState<ActionCtx["openThread"] | undefined>(undefined);

  // Keep latest values in refs so dispatch never goes stale without changing identity
  const threadListRef = useRef(threadList);
  const openThreadRef = useRef(openThread);
  threadListRef.current = threadList;
  openThreadRef.current = openThread;

  const dispatch = useCallback(
    (id: ActionId) => {
      const action = actions[id];
      if (!action) return;
      void action.run({ router, pathname, threadList: threadListRef.current, openThread: openThreadRef.current });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, pathname],
  );

  // Stable callbacks — never change identity, so useEffect deps in consumers are safe
  const registerThreadList = useCallback((list: ActionCtx["threadList"]) => setThreadList(list), []);
  const registerOpenThread = useCallback((t: ActionCtx["openThread"] | undefined) => setOpenThread(t), []);

  const value = useMemo<RegistryValue>(
    () => ({ registerThreadList, registerOpenThread, dispatch }),
    [registerThreadList, registerOpenThread, dispatch],
  );

  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

export function useActions() {
  const ctx = useContext(RegistryContext);
  if (!ctx) throw new Error("useActions outside ActionProvider");
  return ctx;
}
