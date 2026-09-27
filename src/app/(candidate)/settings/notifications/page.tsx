import type { Metadata } from "next";
import { savePreferencesAction } from "@/app/actions/candidate";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PushToggle } from "@/components/push-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ALL_CATEGORIES, ALL_LEVELS, ALL_ORG_TYPES, CATEGORY_LABELS, LEVEL_LABELS, ORG_TYPE_LABELS } from "@/lib/jobs/taxonomy";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const user = await requireUser("/settings/notifications");
  const [pref, orgs] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    prisma.organization.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  const e = env();
  const telegramBot = e.TELEGRAM_BOT_USERNAME;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Notification settings</h1>
        <p className="text-slate-600">Choose what you are alerted about and how. Empty filters mean “any”. Times use Asia/Dhaka.</p>
      </div>
      <ActionForm action={savePreferencesAction} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>What to alert me about</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Job categories</legend>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_CATEGORIES.map((c) => (
                  <Checkbox key={c} name="categories" value={c} defaultChecked={pref?.categories.includes(c)} label={CATEGORY_LABELS[c]} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Organisation types (public / private / foreign bank…)</legend>
              <div className="flex flex-wrap gap-4">
                {ALL_ORG_TYPES.map((t) => (
                  <Checkbox key={t} name="orgTypes" value={t} defaultChecked={pref?.orgTypes.includes(t)} label={ORG_TYPE_LABELS[t]} />
                ))}
              </div>
            </fieldset>
            <Field label="Specific banks / organisations" htmlFor="organizationSlugs" hint="Hold Ctrl/Cmd to select several. Leave empty for all.">
              <select id="organizationSlugs" name="organizationSlugs" multiple defaultValue={pref?.organizationSlugs ?? []} className="h-40 rounded-md border border-slate-300 p-2 text-sm">
                {orgs.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Experience level</legend>
              <div className="flex flex-wrap gap-4">
                {ALL_LEVELS.map((l) => (
                  <Checkbox key={l} name="levels" value={l} defaultChecked={pref?.levels.includes(l)} label={LEVEL_LABELS[l]} />
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Locations" htmlFor="locations" hint="Comma separated, e.g. Dhaka. Remote and “anywhere in Bangladesh” always match.">
                <Input id="locations" name="locations" defaultValue={(pref?.locations ?? []).join(", ")} />
              </Field>
              <Field label="Minimum match score (0–100)" htmlFor="minMatchScore">
                <Input id="minMatchScore" name="minMatchScore" type="number" min={0} max={100} defaultValue={pref?.minMatchScore ?? 45} />
              </Field>
            </div>
            <Checkbox name="academicOnly" defaultChecked={pref?.academicOnly ?? true} label="Skip jobs where I explicitly fail an academic criterion (CGPA, Master's, SSC/HSC, third division, age)" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>When and how</CardTitle>
            <CardDescription>High-priority alerts (strong match closing within 72 hours) are always sent immediately.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Delivery" htmlFor="mode">
              <Select id="mode" name="mode" defaultValue={pref?.mode ?? "IMMEDIATE"} className="sm:max-w-sm">
                <option value="IMMEDIATE">Immediate alert for each new match</option>
                <option value="DAILY_DIGEST">Daily digest at 8:00 AM (Dhaka)</option>
              </Select>
            </Field>
            <div className="flex flex-col gap-2">
              <Checkbox name="emailEnabled" defaultChecked={pref?.emailEnabled ?? true} label={`Email (${user.email})`} />
              <Checkbox name="deadlineReminders" defaultChecked={pref?.deadlineReminders ?? true} label="Deadline reminders for saved/tracked jobs (7 days, 3 days, 24 hours, 6 hours)" />
              <Checkbox name="closingSoonAlerts" defaultChecked={pref?.closingSoonAlerts ?? true} label="Closing-soon alerts for matching jobs I haven't saved" />
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <Checkbox name="telegramEnabled" defaultChecked={pref?.telegramEnabled} label="Telegram" disabled={!e.TELEGRAM_BOT_TOKEN} />
              {e.TELEGRAM_BOT_TOKEN ? (
                <>
                  <p className="mt-2 text-xs text-slate-600">
                    Start a chat with {telegramBot ? <strong>@{telegramBot}</strong> : "our bot"}, send <code>/start</code>, then paste your numeric chat ID
                    (e.g. from @userinfobot).
                  </p>
                  <Field label="Telegram chat ID" htmlFor="telegramChatId" className="mt-2 sm:max-w-sm">
                    <Input id="telegramChatId" name="telegramChatId" inputMode="numeric" defaultValue={pref?.telegramChatId ?? ""} />
                  </Field>
                </>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Telegram alerts are not configured on this server.</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <Checkbox name="pushEnabled" defaultChecked={pref?.pushEnabled} label="Browser push notifications" />
              <div className="mt-3">
                <PushToggle publicKey={e.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
              </div>
            </div>
          </CardContent>
        </Card>
        <div>
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
