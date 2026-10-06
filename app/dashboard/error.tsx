"use client";

import { DatabaseZap, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the dashboard segment.
 *
 * The most likely failure here is the database being unreachable (wrong
 * `DATABASE_URL`, server not running, database not created). Next.js strips
 * server error messages in production, so the guidance below is static.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <DatabaseZap className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Could not load the dashboard</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The application could not reach the database. Check that PostgreSQL is running and that{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">DATABASE_URL</code> in{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code> points to it.
        </p>
        {process.env.NODE_ENV !== "production" && error.message ? (
          <p className="mt-2 max-w-md font-mono text-xs text-muted-foreground break-all">{error.message}</p>
        ) : null}
        {error.digest ? (
          <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
      </div>
      <Button variant="outline" onClick={reset}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
