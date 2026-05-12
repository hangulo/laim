"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AccountInfo {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  isPrimary: boolean;
}

export interface ThreadRef {
  id: string;
  accountId: string;
}

interface AppState {
  accounts: AccountInfo[];
  activeAccountId: string | null;
  cursor: number;
  threadList: ThreadRef[];
  paletteOpen: boolean;
  composerOpen: boolean;
  composerInitial: ComposerInitial | null;
  voiceListening: boolean;
  setAccounts: (accounts: AccountInfo[]) => void;
  setActiveAccount: (id: string) => void;
  cycleAccount: (dir: 1 | -1) => void;
  setCursor: (n: number) => void;
  moveCursor: (delta: number, max: number) => void;
  setThreadList: (list: ThreadRef[]) => void;
  openPalette: () => void;
  closePalette: () => void;
  openComposer: (initial?: ComposerInitial) => void;
  closeComposer: () => void;
  toggleVoice: () => void;
}

export interface ComposerInitial {
  to?: string;
  cc?: string;
  subject?: string;
  bodyText?: string;
  threadId?: string;
  replyToMessageId?: string;
  accountId?: string;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      accounts: [],
      activeAccountId: null,
      cursor: 0,
      threadList: [],
      paletteOpen: false,
      composerOpen: false,
      composerInitial: null,
      voiceListening: false,
      setAccounts: (accounts) =>
        set((s) => ({
          accounts,
          activeAccountId:
            s.activeAccountId && accounts.some((a) => a.id === s.activeAccountId)
              ? s.activeAccountId
              : accounts.find((a) => a.isPrimary)?.id ?? accounts[0]?.id ?? null,
        })),
      setActiveAccount: (id) => set({ activeAccountId: id }),
      cycleAccount: (dir) => {
        const { accounts, activeAccountId } = get();
        if (accounts.length === 0) return;
        const idx = Math.max(0, accounts.findIndex((a) => a.id === activeAccountId));
        const next = (idx + dir + accounts.length) % accounts.length;
        set({ activeAccountId: accounts[next].id });
      },
      setCursor: (n) => set({ cursor: n }),
      moveCursor: (delta, max) =>
        set((s) => ({ cursor: Math.max(0, Math.min(max - 1, s.cursor + delta)) })),
      setThreadList: (list) => set({ threadList: list }),
      openPalette: () => set({ paletteOpen: true }),
      closePalette: () => set({ paletteOpen: false }),
      openComposer: (initial) => set({ composerOpen: true, composerInitial: initial ?? null }),
      closeComposer: () => set({ composerOpen: false, composerInitial: null }),
      toggleVoice: () => set((s) => ({ voiceListening: !s.voiceListening })),
    }),
    {
      name: "laim-app",
      partialize: (s) => ({ activeAccountId: s.activeAccountId }),
    },
  ),
);
