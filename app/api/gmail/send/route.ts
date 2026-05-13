import { NextRequest, NextResponse } from "next/server";
import { getMessageHeaders, sendMessage } from "@/lib/google/gmail";
import { requireAccount } from "@/lib/session";
import { prisma } from "@/lib/db";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

    // Create tracker record before sending so the pixel URL is ready
    let trackerId: string | null = null;
    if (body.trackOpens) {
      const tracker = await prisma.emailTracker.create({
        data: {
          accountId: account.id,
          threadId: body.threadId ?? null,
          toAddress: body.to,
          subject: body.subject,
        },
      });
      trackerId = tracker.id;
    }

    const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const bodyHtml = trackerId
      ? `<div style="white-space:pre-wrap;font-family:inherit;font-size:14px">${escapeHtml(body.bodyText)}</div>` +
        `<img src="${baseUrl}/api/track/${trackerId}" width="1" height="1" style="display:none;opacity:0" alt="" />`
      : undefined;

    const result = await sendMessage(account.id, account.email, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyText: body.bodyText,
      bodyHtml,
      threadId: body.threadId,
      inReplyTo,
      references,
    });

    // If this was a new thread, backfill the threadId on the tracker
    if (trackerId && !body.threadId && result.threadId) {
      await prisma.emailTracker.update({
        where: { id: trackerId },
        data: { threadId: result.threadId },
      });
    }

    return NextResponse.json({ ok: true, threadId: result.threadId, trackerId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
