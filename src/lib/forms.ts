import { z } from "zod";

export interface ActionState {
  ok: boolean;
  message: string;
}

export const initialActionState: ActionState = { ok: false, message: "" };

/** Empty string → undefined, otherwise a finite number. */
export const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v == null || v.trim() === "") return undefined;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `Must be between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });

export const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined));

/** Comma / newline separated list → trimmed unique strings. */
export const csvList = (maxItems = 40, maxLen = 80) =>
  z
    .string()
    .optional()
    .transform((v) => [...new Set((v ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean))].slice(0, maxItems).map((s) => s.slice(0, maxLen)));

export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key.startsWith("$ACTION")) continue;
    out[key] = key in out ? `${out[key]},${value}` : value;
  }
  return out;
}

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Only allow same-site relative redirect targets. */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
