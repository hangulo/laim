"use client";

import { useApp } from "@/lib/store";

export type ActionId =
  | "next"
  | "prev"
  | "open"
  | "back"
  | "archive"
  | "star"
  | "markUnread"
  | "reply"
  | "replyAll"
  | "forward"
  | "compose"
  | "goInbox"
  | "goDashboard"
  | "palette"
  | "nextAccount"
  | "prevAccount";

export interface ActionContext {
  router: { push: (href: string) => void; back: () => void };
  pathname: string;
  threadList: { id: string; accountId: string }[];
  openThread?: { id: string; accountId: string; lastMessageId?: string; subject?: string; from?: string; to?: string; cc?: string };
}

export interface Action {
  id: ActionId;
  label: string;
  hint?: string;
  run: (ctx: ActionContext) => void | Promise<void>;
}

async function modify(threadId: string, accountId: string, action: string, extra: Record<string, unknown> = {}) {
  await fetch(`/api/gmail/threads/${threadId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accountId, action, ...extra }),
  });
}

function parseAddress(raw: string | undefined): string {
  if (!raw) return "";
  const m = raw.match(/<([^>]+)>/);
  return m ? m[1] : raw.trim();
}

export const actions: Record<ActionId, Action> = {
  next: {
    id: "next",
    label: "Next",
    hint: "j",
    run: ({ threadList }) => {
      useApp.getState().moveCursor(1, Math.max(threadList.length, 1));
    },
  },
  prev: {
    id: "prev",
    label: "Previous",
    hint: "k",
    run: ({ threadList }) => {
      useApp.getState().moveCursor(-1, Math.max(threadList.length, 1));
    },
  },
  open: {
    id: "open",
    label: "Open thread",
    hint: "↵",
    run: ({ router, threadList }) => {
      const cursor = useApp.getState().cursor;
      const t = threadList[cursor];
      if (!t) return;
      router.push(`/thread/${t.id}?accountId=${t.accountId}`);
    },
  },
  back: {
    id: "back",
    label: "Back to list",
    hint: "u",
    run: ({ router }) => router.push("/inbox"),
  },
  archive: {
    id: "archive",
    label: "Archive",
    hint: "e",
    run: async ({ router, threadList, openThread, pathname }) => {
      if (openThread) {
        await modify(openThread.id, openThread.accountId, "archive");
        router.push("/inbox");
        return;
      }
      const cursor = useApp.getState().cursor;
      const t = threadList[cursor];
      if (!t) return;
      await modify(t.id, t.accountId, "archive");
      window.dispatchEvent(new CustomEvent("laim:refresh-threads"));
      if (pathname === "/inbox") {
        useApp.getState().moveCursor(0, Math.max(threadList.length - 1, 1));
      }
    },
  },
  star: {
    id: "star",
    label: "Star",
    hint: "s",
    run: async ({ threadList, openThread }) => {
      const target = openThread ?? threadList[useApp.getState().cursor];
      if (!target) return;
      await modify(target.id, target.accountId, "star", { starred: true });
      window.dispatchEvent(new CustomEvent("laim:refresh-threads"));
    },
  },
  markUnread: {
    id: "markUnread",
    label: "Mark unread",
    hint: "U",
    run: async ({ threadList, openThread }) => {
      const target = openThread ?? threadList[useApp.getState().cursor];
      if (!target) return;
      await modify(target.id, target.accountId, "markRead", { read: false });
      window.dispatchEvent(new CustomEvent("laim:refresh-threads"));
    },
  },
  reply: {
    id: "reply",
    label: "Reply",
    hint: "r",
    run: ({ openThread }) => {
      if (!openThread) return;
      useApp.getState().openComposer({
        accountId: openThread.accountId,
        threadId: openThread.id,
        replyToMessageId: openThread.lastMessageId,
        to: parseAddress(openThread.from),
        subject: openThread.subject?.startsWith("Re:") ? openThread.subject : `Re: ${openThread.subject ?? ""}`,
      });
    },
  },
  replyAll: {
    id: "replyAll",
    label: "Reply all",
    hint: "a",
    run: ({ openThread }) => {
      if (!openThread) return;
      const cc = [openThread.to, openThread.cc].filter(Boolean).join(", ");
      useApp.getState().openComposer({
        accountId: openThread.accountId,
        threadId: openThread.id,
        replyToMessageId: openThread.lastMessageId,
        to: parseAddress(openThread.from),
        cc,
        subject: openThread.subject?.startsWith("Re:") ? openThread.subject : `Re: ${openThread.subject ?? ""}`,
      });
    },
  },
  forward: {
    id: "forward",
    label: "Forward",
    hint: "f",
    run: ({ openThread }) => {
      if (!openThread) return;
      useApp.getState().openComposer({
        accountId: openThread.accountId,
        subject: `Fwd: ${openThread.subject ?? ""}`,
      });
    },
  },
  compose: {
    id: "compose",
    label: "Compose",
    hint: "c",
    run: () => useApp.getState().openComposer({}),
  },
  goInbox: {
    id: "goInbox",
    label: "Go to inbox",
    hint: "g i",
    run: ({ router }) => router.push("/inbox"),
  },
  goDashboard: {
    id: "goDashboard",
    label: "Go to dashboard",
    hint: "g d",
    run: ({ router }) => router.push("/"),
  },
  palette: {
    id: "palette",
    label: "Command palette",
    hint: "⌘K",
    run: () => useApp.getState().openPalette(),
  },
  nextAccount: {
    id: "nextAccount",
    label: "Next account",
    hint: "]",
    run: () => useApp.getState().cycleAccount(1),
  },
  prevAccount: {
    id: "prevAccount",
    label: "Previous account",
    hint: "[",
    run: () => useApp.getState().cycleAccount(-1),
  },
};

export const actionList: Action[] = Object.values(actions);
