"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesUnread?: number;
  messagesTotal?: number;
}

const SYSTEM_SECTIONS = [
  { id: "INBOX",     label: "Inbox",     icon: "inbox" },
  { id: "STARRED",   label: "Starred",   icon: "star" },
  { id: "SNOOZED",   label: "Snoozed",   icon: "clock" },
  { id: "IMPORTANT", label: "Important", icon: "important" },
  { id: "SENT",      label: "Sent",      icon: "sent" },
  { id: "DRAFT",     label: "Drafts",    icon: "draft" },
];


function NavIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0";
  switch (type) {
    case "inbox":     return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
    case "star":      return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>;
    case "clock":     return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "important": return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3-3 3M5 12h11M3 5h18M3 19h18" /></svg>;
    case "sent":      return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
    case "draft":     return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    case "tag":       return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>;
    case "social":    return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "updates":   return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "forums":    return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>;
    case "purchases": return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>;
    default:          return <svg className={cls} fill="currentColor" viewBox="0 0 24 24"><path d="M7 7h10v2H7zm0 4h10v2H7z" /></svg>;
  }
}

function fmt(n: number | undefined): string | null {
  if (!n) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function InboxNav() {
  const accountId = useApp((s) => s.activeAccountId);
  const searchParams = useSearchParams();
  const activeLabel = searchParams.get("label") ?? "INBOX";
  const [labels, setLabels] = useState<GmailLabel[]>([]);

  useEffect(() => {
    if (!accountId) return;
    fetch(`/api/gmail/labels?accountId=${accountId}`)
      .then((r) => r.json())
      .then((d) => setLabels(d.labels ?? []));
  }, [accountId]);

  const byId = Object.fromEntries(labels.map((l) => [l.id, l]));

  function navLink(labelId: string) {
    return `/inbox?label=${labelId}`;
  }

  function NavItem({ id, label, icon, unread }: { id: string; label: string; icon: string; unread?: number }) {
    const active = activeLabel === id;
    return (
      <Link
        href={navLink(id)}
        className={`flex items-center gap-2.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
          active
            ? "bg-blue-100 font-semibold text-blue-700"
            : "text-neutral-700 hover:bg-neutral-100"
        }`}
      >
        <NavIcon type={icon} />
        <span className="flex-1 truncate">{label}</span>
        {unread ? <span className={`text-xs font-medium ${active ? "text-blue-600" : "text-neutral-500"}`}>{fmt(unread)}</span> : null}
      </Link>
    );
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-neutral-200 bg-white px-2 py-3">
      {SYSTEM_SECTIONS.map((s) => (
        <NavItem
          key={s.id}
          id={s.id}
          label={s.id === "DRAFT" ? `${s.label}${byId["DRAFT"]?.messagesTotal ? ` ${byId["DRAFT"].messagesTotal}` : ""}` : s.label}
          icon={s.icon}
          unread={s.id !== "SENT" && s.id !== "DRAFT" ? byId[s.id]?.messagesUnread : undefined}
        />
      ))}

    </nav>
  );
}
