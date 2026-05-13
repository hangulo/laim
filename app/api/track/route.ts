import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/session";

// GET /api/track?threadId=X&accountId=Y — returns tracker + opens for a thread
export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get("accountId");
    const threadId = req.nextUrl.searchParams.get("threadId");
    if (!threadId) return NextResponse.json(null);

    await requireAccount(accountId);

    const tracker = await prisma.emailTracker.findFirst({
      where: { accountId: accountId!, threadId },
      include: { opens: { orderBy: { openedAt: "desc" } } },
    });

    return NextResponse.json(tracker ?? null);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
