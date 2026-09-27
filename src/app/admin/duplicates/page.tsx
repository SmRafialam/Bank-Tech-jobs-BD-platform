import Link from "next/link";
import { resolveDuplicateAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatDhakaDate } from "@/lib/time";

export default async function AdminDuplicatesPage() {
  const pending = await prisma.duplicateCandidate.findMany({
    where: { status: "PENDING" },
    orderBy: { score: "desc" },
    include: {
      job: { include: { organization: { select: { name: true } }, _count: { select: { links: true } } } },
      candidateJob: { include: { organization: { select: { name: true } }, _count: { select: { links: true } } } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Duplicate merge queue</h1>
        <p className="text-slate-600">
          Fuzzy matches (75–92 % title similarity, same organisation, deadlines within 3 days). Exact matches on source ID, URL, fingerprint or content
          hash are merged automatically. Merging keeps the left job and moves links, saves and tracker entries.
        </p>
      </div>
      {pending.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Queue is empty.</p> : null}
      {pending.map((d) => (
        <Card key={d.id}>
          <CardContent className="grid gap-4 pt-5 md:grid-cols-[1fr_1fr_auto]">
            {[d.job, d.candidateJob].map((j, i) => (
              <div key={j.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-xs uppercase text-slate-500">{i === 0 ? "Keep" : "Candidate duplicate"}</p>
                <Link href={`/admin/jobs/${j.id}`} className="font-medium text-navy-900 hover:underline">
                  {j.title}
                </Link>
                <p className="text-slate-600">
                  {j.organization.name} · deadline {formatDhakaDate(j.deadline)} · {j._count.links} source(s)
                </p>
                <p className="text-xs text-slate-500">{j.sourceName}</p>
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{Math.round(d.score * 100)}% similar</p>
              <p className="text-xs text-slate-500">{d.reasons.join(" · ")}</p>
              <form action={resolveDuplicateAction}>
                <input type="hidden" name="duplicateId" value={d.id} />
                <input type="hidden" name="decision" value="merge" />
                <SubmitButton size="sm">Merge</SubmitButton>
              </form>
              <form action={resolveDuplicateAction}>
                <input type="hidden" name="duplicateId" value={d.id} />
                <input type="hidden" name="decision" value="dismiss" />
                <SubmitButton size="sm" variant="outline">
                  Not a duplicate
                </SubmitButton>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
