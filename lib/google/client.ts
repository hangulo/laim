import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/db";

export function oauth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
  );
}

export async function authedClient(accountId: string): Promise<OAuth2Client> {
  const account = await prisma.linkedGoogleAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`Linked account ${accountId} not found`);

  const client = oauth2Client();
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken ?? undefined,
    expiry_date: account.expiresAt ? account.expiresAt * 1000 : undefined,
    scope: account.scope ?? undefined,
    token_type: account.tokenType ?? undefined,
    id_token: account.idToken ?? undefined,
  });

  client.on("tokens", async (tokens) => {
    await prisma.linkedGoogleAccount.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token ?? account.accessToken,
        refreshToken: tokens.refresh_token ?? account.refreshToken ?? null,
        expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : account.expiresAt,
      },
    });
  });

  return client;
}
