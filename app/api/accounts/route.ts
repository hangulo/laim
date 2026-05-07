import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({
      accounts: user.accounts.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        image: a.image,
        isPrimary: a.isPrimary,
      })),
    });
  } catch {
    return NextResponse.json({ accounts: [] }, { status: 401 });
  }
}
