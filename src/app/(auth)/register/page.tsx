import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Create your free account</CardTitle>
          <CardDescription>Get eligibility checks, job alerts and deadline reminders. We only ask for what the matching needs.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={registerAction} className="flex flex-col gap-4">
            <Field label="Full name" htmlFor="name">
              <Input id="name" name="name" autoComplete="name" required minLength={2} maxLength={100} />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Password" htmlFor="password" hint="At least 10 characters.">
              <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
            </Field>
            <Field label="Confirm password" htmlFor="confirm">
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
            </Field>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-blue-600" />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="underline">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
          </ActionForm>
          <p className="mt-4 text-sm text-slate-600">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-blue-700 underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
