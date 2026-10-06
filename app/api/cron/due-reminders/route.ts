import { NextResponse } from "next/server";

import { runDailyChecksForAllBusinesses } from "@/lib/email/due-reminders";

/**
 * Daily due-date job: promotes overdue invoices, refreshes payment
 * notifications and emails reminders for invoices due today.
 *
 * Protected by CRON_SECRET (sent as `Authorization: Bearer <secret>`; Vercel
 * Cron adds this header automatically). When no secret is configured the
 * route is open outside production so it can be triggered locally.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await runDailyChecksForAllBusinesses();
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}
