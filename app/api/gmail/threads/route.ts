import { NextRequest, NextResponse } from "next/server";
import { listThreads } from "@/lib/google/gmail";
import { requireAccount, requireUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get("accountId");
    const query = req.nextUrl.searchParams.get("q") ?? undefined;
    const label = req.nextUrl.searchParams.get("label");
    const aggregate = req.nextUrl.searchParams.get("aggregate") === "1";
    const max = Number(req.nextUrl.searchParams.get("max") ?? 25);
    const pageToken = req.nextUrl.searchParams.get("pageToken") ?? undefined;

    if (aggregate) {
      const user = await requireUser();
      const all = await Promise.all(
        user.accounts.map(async (a) => {
          const { threads } = await listThreads(a.id, { query, labelIds: label ? [label] : ["INBOX"], maxResults: max });
          return threads.map((t) => ({ ...t, accountId: a.id, accountEmail: a.email }));
        }),
      );
      return NextResponse.json({ threads: all.flat() });
    }

    const { account } = await requireAccount(accountId);
    const labelIds = label ? label.split(",").map((l) => l.trim()) : ["INBOX"];
    const { threads, nextPageToken } = await listThreads(account.id, {
      query,
      labelIds,
      maxResults: max,
      pageToken,
      myEmail: account.email,
    });
    return NextResponse.json({
      accountId: account.id,
      accountEmail: account.email,
      threads,
      nextPageToken,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
