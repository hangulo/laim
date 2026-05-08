import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { authedClient } from "@/lib/google/client";
import { requireAccount } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get("accountId");
    const { account } = await requireAccount(accountId);
    const auth = await authedClient(account.id);
    const gmail = google.gmail({ version: "v1", auth });
    const { data } = await gmail.users.labels.list({ userId: "me" });
    return NextResponse.json({ labels: data.labels ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
