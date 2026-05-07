import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { oauth2Client } from "@/lib/google/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.redirect(new URL("/api/auth/signin", process.env.NEXTAUTH_URL!));
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/?error=missing_code", process.env.NEXTAUTH_URL!));

  const client = oauth2Client();
  const { tokens } = await client.getToken({
    code,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/accounts/callback`,
  });
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();
  const email = me.data.email;
  if (!email) return NextResponse.redirect(new URL("/?error=no_email", process.env.NEXTAUTH_URL!));

  await prisma.linkedGoogleAccount.upsert({
    where: { userId_email: { userId: user.id, email } },
    update: {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
      scope: tokens.scope ?? null,
      tokenType: tokens.token_type ?? null,
      idToken: tokens.id_token ?? null,
      name: me.data.name ?? null,
      image: me.data.picture ?? null,
    },
    create: {
      userId: user.id,
      email,
      name: me.data.name ?? null,
      image: me.data.picture ?? null,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
      scope: tokens.scope ?? null,
      tokenType: tokens.token_type ?? null,
      idToken: tokens.id_token ?? null,
      isPrimary: false,
    },
  });

  return NextResponse.redirect(new URL("/?added=1", process.env.NEXTAUTH_URL!));
}
