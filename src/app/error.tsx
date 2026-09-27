"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold text-navy-900">Something went wrong</h1>
      <p className="mt-2 text-slate-600">Please try again. If the problem persists, the database may be unavailable.</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-slate-400">Reference: {error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
