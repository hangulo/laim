"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
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

  const dispatch = useCallback(
    (id: ActionId) => {
      const action = actions[id];
      if (!action) return;
      void action.run({ router, pathname, threadList, openThread });
    },
    [router, pathname, threadList, openThread],
  );

  const value = useMemo<RegistryValue>(
    () => ({
      registerThreadList: (list) => setThreadList(list),
      registerOpenThread: (t) => setOpenThread(t),
      dispatch,
    }),
    [dispatch],
  );

  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

export function useActions() {
  const ctx = useContext(RegistryContext);
  if (!ctx) throw new Error("useActions outside ActionProvider");
  return ctx;
}
