import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { clientIpFromHeaders } from "@/lib/rate-limit";

export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Require a signed-in user (redirects to /login). */
export async function requireUser(callbackPath?: string) {
  const user = await currentUser();
  if (!user?.id) redirect(`/login${callbackPath ? `?callbackUrl=${encodeURIComponent(callbackPath)}` : ""}`);
  return user;
}

/** Require an admin. The role is re-read from the database so a demotion takes effect immediately. */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (fresh?.role !== "ADMIN") redirect("/");
  return user;
}

export async function requestIp() {
  return clientIpFromHeaders(await headers());
}
