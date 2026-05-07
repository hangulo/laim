"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useApp } from "@/lib/store";

export function AccountsLoader() {
  const { status } = useSession();
  const setAccounts = useApp((s) => s.setAccounts);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts ?? []))
      .catch(() => {});
  }, [status, setAccounts]);

  return null;
}
