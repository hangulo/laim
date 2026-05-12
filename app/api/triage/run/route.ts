import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { listThreads, getThread } from "@/lib/google/gmail";
import { triageThreadsBatch, type TriageInput } from "@/lib/ai/triage";

export async function POST() {
  try {
    const user = await requireUser();

    let triaged = 0;
    let cached = 0;

    for (const account of user.accounts) {
      const { threads: summaries } = await listThreads(account.id, {
        labelIds: ["INBOX"],
        maxResults: 30,
        query: "is:unread",
      });

      const toTriage: TriageInput[] = [];
      const summaryMap = new Map(summaries.map((s) => [s.id, s]));

      for (const s of summaries) {
        const existing = await prisma.triageResult.findUnique({
          where: { userId_accountId_threadId: { userId: user.id, accountId: account.id, threadId: s.id } },
        });
        if (existing && existing.historyId === (s.historyId ?? "")) {
          cached++;
          continue;
        }

        let bodyText = s.snippet;
        try {
          const full = await getThread(account.id, s.id);
          const last = full.messages[full.messages.length - 1];
          if (last?.bodyText) bodyText = last.bodyText;
        } catch { /* fall back to snippet */ }

        toTriage.push({ threadId: s.id, subject: s.subject, from: s.from, snippet: s.snippet, bodyText });
      }

      if (toTriage.length > 0) {
        const outputs = await triageThreadsBatch(toTriage);
        for (const [threadId, output] of outputs.entries()) {
          const s = summaryMap.get(threadId);
          await prisma.triageResult.upsert({
            where: { userId_accountId_threadId: { userId: user.id, accountId: account.id, threadId } },
            create: {
              userId: user.id, accountId: account.id, threadId,
              historyId: s?.historyId ?? "",
              category: output.category, summary: output.summary, urgency: output.urgency,
              subject: s?.subject ?? "", fromHeader: s?.from ?? "", date: s?.date ?? "",
              accountEmail: account.email,
            },
            update: {
              historyId: s?.historyId ?? "",
              category: output.category, summary: output.summary, urgency: output.urgency,
              subject: s?.subject ?? "", fromHeader: s?.from ?? "", date: s?.date ?? "",
              accountEmail: account.email,
            },
          });
          triaged++;
        }
      }
    }

    return NextResponse.json({ triaged, cached, total: triaged + cached });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[triage/run]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
