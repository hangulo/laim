import { ThreadList } from "@/components/inbox/ThreadList";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <ThreadList />
      </div>
    </div>
  );
}
