import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}

let dummyHash: string | undefined;

const credentialsSchema = z.object({
  email: z.email().max(200).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: process.env.AUTH_TRUST_HOST === "true" || process.env.NODE_ENV !== "production" || Boolean(process.env.VERCEL),
  providers: [
    Credentials({
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const ip = clientIpFromHeaders(request?.headers);
        const limited = await rateLimit(`login:${ip}:${parsed.data.email}`, 10, 15 * 60);
        if (!limited.ok) {
          await audit({ action: "auth.login.rate_limited", entity: "User", meta: { email: parsed.data.email }, ip });
          return null;
        }
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        // Compare against a dummy hash when the user does not exist to keep timing uniform.
        dummyHash ??= await bcrypt.hash("timing-equaliser", 12);
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? dummyHash);
        if (!user || !ok) {
          await audit({ action: "auth.login.failed", entity: "User", meta: { email: parsed.data.email }, ip });
          return null;
        }
        await audit({ actorId: user.id, action: "auth.login.success", entity: "User", entityId: user.id, ip });
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "USER";
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      session.user.role = token.role ?? "USER";
      return session;
    },
  },
});
