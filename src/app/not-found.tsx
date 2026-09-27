import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold text-navy-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The job may have been removed or archived after its deadline.</p>
      <Button asChild className="mt-6">
        <Link href="/jobs">Browse open jobs</Link>
      </Button>
    </div>
  );
}
