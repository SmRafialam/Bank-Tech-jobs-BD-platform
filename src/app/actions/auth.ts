"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { firstIssue, formObject, safeRedirectPath, type ActionState } from "@/lib/forms";
import { rateLimit } from "@/lib/rate-limit";
import { requestIp } from "@/lib/session";

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(100),
    email: z.email("Enter a valid email").max(200).transform((v) => v.toLowerCase().trim()),
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirm: z.string(),
    terms: z.literal("on", { message: "Please accept the Terms of Use and Privacy Policy" }),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await requestIp();
  const limited = await rateLimit(`register:${ip}`, 5, 60 * 60);
  if (!limited.ok) return { ok: false, message: "Too many sign-up attempts. Please try again later." };

  const parsed = registerSchema.safeParse(formObject(formData));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { name, email, password } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { ok: false, message: "An account with this email already exists. Try signing in." };

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      profile: { create: { fullName: name } },
      preference: { create: {} },
    },
  });
  await audit({ actorId: user.id, action: "auth.register", entity: "User", entityId: user.id, ip });

  try {
    await signIn("credentials", { email, password, redirectTo: "/settings/profile?welcome=1" });
  } catch (error) {
    if (error instanceof AuthError) return { ok: true, message: "Account created. Please sign in." };
    throw error;
  }
  return { ok: true, message: "Account created." };
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = formObject(formData);
  try {
    await signIn("credentials", {
      email: data.email ?? "",
      password: data.password ?? "",
      redirectTo: safeRedirectPath(data.callbackUrl, "/dashboard"),
    });
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, message: "Invalid email or password (or too many attempts — wait 15 minutes)." };
    throw error;
  }
  return { ok: true, message: "" };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
