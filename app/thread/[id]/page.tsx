import { ThreadReader } from "@/components/inbox/ThreadReader";

export const dynamic = "force-dynamic";

export default function ThreadPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { accountId?: string };
}) {
  const accountId = searchParams.accountId ?? "";
  return (
    <div className="mx-auto max-w-7xl px-6 py-4">
      <ThreadReader threadId={params.id} accountId={accountId} />
    </div>
  );
}
