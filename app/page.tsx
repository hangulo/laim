import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ScheduleAtAGlance } from "@/components/dashboard/ScheduleAtAGlance";
import { TriageDashboard } from "@/components/dashboard/TriageDashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return (
      <div className="mx-auto max-w-2xl p-10">
        <h1 className="text-xl font-semibold">Welcome to laim</h1>
        <p className="pt-2 text-sm text-neutral-600 dark:text-neutral-400">
          A fast, AI-native Gmail client. Sign in with Google to get started — link as many Gmail accounts as you like.
        </p>
        <a
          href="/api/auth/signin"
          className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
        >
          Sign in with Google
        </a>
      </div>
    );
  }

  const today = new Date().toLocaleDateString([], {
    weekday: "long", month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold dark:text-white">Triage</h1>
        <div className="text-xs uppercase tracking-wider text-neutral-500">{today}</div>
      </div>
      <ScheduleAtAGlance />
      <TriageDashboard />
    </div>
  );
}
