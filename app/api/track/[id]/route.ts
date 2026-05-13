import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 1×1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// Public endpoint — no auth. Called by recipient's email client when they open the email.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.emailOpen.create({
      data: {
        trackerId: params.id,
        userAgent: req.headers.get("user-agent") ?? undefined,
        ip: (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined)
          ?.split(",")[0].trim(),
      },
    });
  } catch {
    // Tracker ID not found or DB error — still return the pixel so the client doesn't break
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate, private",
      "Pragma": "no-cache",
    },
  });
}
