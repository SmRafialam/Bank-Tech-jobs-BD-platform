export function Prose({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-navy-900">{title}</h1>
      {updated ? <p className="mt-1 text-sm text-slate-500">Last updated {updated}</p> : null}
      <div className="mt-6 flex flex-col gap-4 leading-relaxed text-slate-800 [&_a]:text-blue-700 [&_a]:underline [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-navy-900 [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </article>
  );
}
