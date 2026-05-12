import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const results = await prisma.triageResult.findMany({
      where: { userId: user.id, ...(category ? { category } : {}) },
      orderBy: [{ urgency: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
