import { NextRequest, NextResponse } from "next/server";
import { getMessageHeaders, sendMessage } from "@/lib/google/gmail";
import { requireAccount } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { account } = await requireAccount(body.accountId);

    let inReplyTo: string | undefined;
    let references: string | undefined;
    if (body.replyToMessageId) {
      const headers = await getMessageHeaders(account.id, body.replyToMessageId);
      inReplyTo = headers["Message-Id"] ?? headers["Message-ID"];
      references = headers["References"]
        ? `${headers["References"]} ${inReplyTo ?? ""}`.trim()
        : inReplyTo;
    }

    await sendMessage(account.id, account.email, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyText: body.bodyText,
      threadId: body.threadId,
      inReplyTo,
      references,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
