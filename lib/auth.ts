import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider !== "google" || !user.email) return false;

      const dbUser = await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name ?? undefined, image: user.image ?? undefined },
        create: {
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        },
      });

      const existingPrimary = await prisma.linkedGoogleAccount.findFirst({
        where: { userId: dbUser.id, isPrimary: true },
      });

      await prisma.linkedGoogleAccount.upsert({
        where: { userId_email: { userId: dbUser.id, email: user.email } },
        update: {
          accessToken: account.access_token!,
          refreshToken: account.refresh_token ?? undefined,
          expiresAt: account.expires_at ?? null,
          scope: account.scope ?? null,
          tokenType: account.token_type ?? null,
          idToken: account.id_token ?? null,
          name: user.name ?? null,
          image: user.image ?? null,
        },
        create: {
          userId: dbUser.id,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
          accessToken: account.access_token!,
          refreshToken: account.refresh_token ?? null,
          expiresAt: account.expires_at ?? null,
          scope: account.scope ?? null,
          tokenType: account.token_type ?? null,
          idToken: account.id_token ?? null,
          isPrimary: !existingPrimary,
        },
      });

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      if (token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email as string } });
        if (dbUser) token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.userId as string | undefined;
      }
      return session;
    },
  },
};
