import { Resend } from "resend";
import webpush from "web-push";
import type { DeliveryStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { errorMessage } from "@/lib/utils";

export interface DeliveryResult {
  status: DeliveryStatus;
  target?: string;
  error?: string;
}

let resend: Resend | null = null;

/** Email via Resend. Without RESEND_API_KEY the message is logged (development mode) and recorded as LOGGED. */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<DeliveryResult> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}\n`);
    return { status: "LOGGED", target: to };
  }
  try {
    resend ??= new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text });
    if (error) return { status: "FAILED", target: to, error: error.message };
    return { status: "SENT", target: to };
  } catch (error) {
    return { status: "FAILED", target: to, error: errorMessage(error) };
  }
}

/** Telegram Bot API sendMessage. Optional: requires TELEGRAM_BOT_TOKEN and a chat id saved by the user. */
export async function sendTelegram(chatId: string, text: string): Promise<DeliveryResult> {
  const token = env().TELEGRAM_BOT_TOKEN;
  if (!token) return { status: "SKIPPED", target: chatId, error: "TELEGRAM_BOT_TOKEN not configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) return { status: "FAILED", target: chatId, error: `Telegram HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { status: "SENT", target: chatId };
  } catch (error) {
    return { status: "FAILED", target: chatId, error: errorMessage(error) };
  }
}

let vapidConfigured = false;

export function pushConfigured(): boolean {
  const e = env();
  return Boolean(e.NEXT_PUBLIC_VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY);
}

/** Web Push to every subscription of a user. Expired subscriptions (404/410) are removed. */
export async function sendPush(userId: string, payload: { title: string; body: string; url?: string }): Promise<DeliveryResult> {
  if (!pushConfigured()) return { status: "SKIPPED", error: "VAPID keys not configured" };
  const e = env();
  if (!vapidConfigured) {
    webpush.setVapidDetails(e.VAPID_SUBJECT, e.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
    vapidConfigured = true;
  }
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return { status: "SKIPPED", error: "No push subscription" };
  let sent = 0;
  let lastError: string | undefined;
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      lastError = errorMessage(error);
    }
  }
  return sent > 0 ? { status: "SENT", target: `${sent} device(s)` } : { status: "FAILED", error: lastError };
}
