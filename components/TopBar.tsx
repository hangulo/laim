"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { AccountSwitcher } from "./account/AccountSwitcher";
import { useActions } from "./shortcuts/ActionContext";

export function TopBar() {
  const { data: session, status } = useSession();
  const { dispatch } = useActions();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight">laim</Link>
        <nav className="flex items-center gap-3 text-xs text-neutral-600">
          <Link href="/" className="hover:text-neutral-900">Triage</Link>
          <Link href="/inbox" className="hover:text-neutral-900">Inbox</Link>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => dispatch("palette")}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1 font-mono text-xs text-neutral-500 hover:bg-neutral-50"
        >
          ⌘K
        </button>
        {status === "authenticated" ? (
          <>
            <AccountSwitcher />
            <button
              onClick={() => signOut()}
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              Sign out ({session?.user?.email})
            </button>
          </>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white hover:bg-neutral-800"
          >
            Sign in with Google
          </button>
        )}
      </div>
    </header>
  );
}
