import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { getEmailProvider, isEmailConfigured } from "@/lib/email/provider";
import { isTurnstileEnabled } from "@/lib/auth/turnstile";

/**
 * Deployment diagnostics: which database host and email provider this
 * instance is wired to, and whether the database answers. Never exposes
 * secrets; hosts are reported without credentials. Safe to leave enabled.
 */
export const dynamic = "force-dynamic";

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "unparseable";
  }
}

export async function GET() {
  const startedAt = Date.now();
  let database: { ok: boolean; host: string | null; migrations?: number; users?: number; error?: string } = {
    ok: false,
    host: hostOf(process.env.DATABASE_URL),
  };
  try {
    const [row] = await db.execute<{ migrations: number; users: number }>(sql`
      select
        (select count(*)::int from drizzle.__drizzle_migrations) as migrations,
        (select count(*)::int from users) as users
    `);
    database = { ...database, ok: true, migrations: Number(row?.migrations ?? 0), users: Number(row?.users ?? 0) };
  } catch (error) {
    database.error = error instanceof Error ? error.message.split("\n")[0].slice(0, 200) : String(error);
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  return NextResponse.json({
    ok: database.ok,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    region: process.env.VERCEL_REGION ?? null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    database,
    email: {
      configured: isEmailConfigured(),
      provider: getEmailProvider().name,
      smtpHost: smtpHost ? `${smtpHost}:${process.env.SMTP_PORT?.trim() || "587"}` : null,
      from: process.env.EMAIL_FROM?.trim() || process.env.SMTP_FROM?.trim() || null,
    },
    turnstile: isTurnstileEnabled(),
    cronSecretSet: !!process.env.CRON_SECRET?.trim(),
  });
}
