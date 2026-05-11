"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ActionProvider } from "@/components/shortcuts/ActionContext";
import { HotkeyProvider } from "@/components/shortcuts/HotkeyProvider";
import { MouseHandler } from "@/components/shortcuts/MouseHandler";
import { CommandPalette } from "@/components/shortcuts/CommandPalette";
import { Composer } from "@/components/compose/Composer";
import { AccountsLoader } from "@/components/account/AccountsLoader";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        <ActionProvider>
          <AccountsLoader />
          <HotkeyProvider />
          <MouseHandler />
          <CommandPalette />
          <Composer />
          {children}
        </ActionProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
