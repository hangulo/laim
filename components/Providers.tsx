"use client";

import { SessionProvider } from "next-auth/react";
import { ActionProvider } from "@/components/shortcuts/ActionContext";
import { HotkeyProvider } from "@/components/shortcuts/HotkeyProvider";
import { CommandPalette } from "@/components/shortcuts/CommandPalette";
import { Composer } from "@/components/compose/Composer";
import { AccountsLoader } from "@/components/account/AccountsLoader";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ActionProvider>
        <AccountsLoader />
        <HotkeyProvider />
        <CommandPalette />
        <Composer />
        {children}
      </ActionProvider>
    </SessionProvider>
  );
}
