"use client";

import { useApp } from "@/lib/store";

export function AccountSwitcher() {
  const accounts = useApp((s) => s.accounts);
  const active = useApp((s) => s.activeAccountId);
  const setActive = useApp((s) => s.setActiveAccount);

  if (accounts.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        value={active ?? ""}
        onChange={(e) => setActive(e.target.value)}
        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.email}
          </option>
        ))}
      </select>
      <a
        href="/api/accounts/add"
        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
        title="Link another Google account"
      >
        + account
      </a>
    </div>
  );
}
