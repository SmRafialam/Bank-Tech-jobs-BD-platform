import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { safeRedirectPath } from "@/lib/forms";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const callbackUrl = safeRedirectPath((await searchParams).callbackUrl, "/dashboard");
  if (await currentUser()) redirect(callbackUrl);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Access your matches, saved jobs, tracker and alerts.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={loginAction} className="flex flex-col gap-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
          </ActionForm>
          <p className="mt-4 text-sm text-slate-600">
            New here?{" "}
            <Link href="/register" className="font-medium text-blue-700 underline">
              Create a free account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
