import { NextResponse } from "next/server";
import { oauth2Client } from "@/lib/google/client";
import { requireUser } from "@/lib/session";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.redirect(new URL("/api/auth/signin", process.env.NEXTAUTH_URL!));
  }

  const client = oauth2Client();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    scope: SCOPES,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/accounts/callback`,
  });
  return NextResponse.redirect(url);
}
