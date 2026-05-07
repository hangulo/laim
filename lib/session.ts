import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) throw new Error("UNAUTHENTICATED");
  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
  });
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAccount(accountId: string | null | undefined) {
  const user = await requireUser();
  const account = accountId
    ? user.accounts.find((a) => a.id === accountId)
    : user.accounts.find((a) => a.isPrimary) ?? user.accounts[0];
  if (!account) throw new Error("NO_ACCOUNT");
  return { user, account };
}
