import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { TopBar } from "@/components/TopBar";
import { VERSION } from "@/lib/version";

export const metadata: Metadata = {
  title: "laim",
  description: "Fast, AI-native Gmail client",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <TopBar />
          <main>{children}</main>
          <div className="fixed bottom-3 left-3 z-50 font-mono text-[10px] text-neutral-400 dark:text-neutral-600 select-none pointer-events-none">
            v{VERSION}
          </div>
        </Providers>
      </body>
    </html>
  );
}
