import { ThreadList } from "@/components/inbox/ThreadList";
import { InboxNav } from "@/components/inbox/InboxNav";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return (
    <div className="flex h-[calc(100vh-49px)]">
      <InboxNav />
      <div className="flex-1 overflow-y-auto">
        <div className="rounded-xl border border-neutral-200 bg-white mx-4 my-4 overflow-hidden">
          <ThreadList />
        </div>
      </div>
    </div>
  );
}
