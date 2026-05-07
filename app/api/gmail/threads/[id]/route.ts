import { NextRequest, NextResponse } from "next/server";
import { archiveThread, getThread, markRead, modifyThread, starThread } from "@/lib/google/gmail";
import { requireAccount } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const accountId = req.nextUrl.searchParams.get("accountId");
    const { account } = await requireAccount(accountId);
    const thread = await getThread(account.id, params.id);
    return NextResponse.json({ accountId: account.id, accountEmail: account.email, thread });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const accountId: string | undefined = body.accountId;
    const { account } = await requireAccount(accountId);
    const action: string = body.action;

    switch (action) {
      case "archive":
        await archiveThread(account.id, params.id);
        break;
      case "star":
        await starThread(account.id, params.id, !!body.starred);
        break;
      case "markRead":
        await markRead(account.id, params.id, !!body.read);
        break;
      case "modify":
        await modifyThread(account.id, params.id, body.add ?? [], body.remove ?? []);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
