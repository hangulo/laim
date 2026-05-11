"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AccountSwitcher } from "./account/AccountSwitcher";
import { useActions } from "./shortcuts/ActionContext";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-7 w-7" />;

  const dark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export function TopBar() {
  const { data: session, status } = useSession();
  const { dispatch } = useActions();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight dark:text-white">laim</Link>
        <nav className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
          <Link href="/" className="hover:text-neutral-900 dark:hover:text-white">Triage</Link>
          <Link href="/inbox" className="hover:text-neutral-900 dark:hover:text-white">Inbox</Link>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch("palette")}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1 font-mono text-xs text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
        >
          ⌘K
        </button>
        <ThemeToggle />
        {status === "authenticated" ? (
          <>
            <AccountSwitcher />
            <button
              onClick={() => signOut()}
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            >
              Sign out ({session?.user?.email})
            </button>
          </>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="rounded-md bg-neutral-900 px-3 py-1 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            Sign in with Google
          </button>
        )}
      </div>
    </header>
  );
}
