import "server-only";

/**
 * Cloudflare Turnstile verification for the sign-in form.
 *
 * Enabled when both TURNSTILE_SECRET_KEY (server) and
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY (widget) are set. Without them the widget is
 * not rendered and the login action skips the check, so local development
 * keeps working. Cloudflare's always-pass test pair is documented in
 * .env.example for trying the flow without a real site.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;
}

export function isTurnstileEnabled(): boolean {
  return !!(process.env.TURNSTILE_SECRET_KEY?.trim() && turnstileSiteKey());
}

export interface TurnstileResult {
  ok: boolean;
  /** Cloudflare error codes when verification fails, e.g. ["timeout-or-duplicate"]. */
  errors: string[];
}

/** Validates a widget token with Cloudflare. A token can be verified only once. */
export async function verifyTurnstileToken(token: string | undefined, remoteIp?: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return { ok: true, errors: [] };
  if (!token?.trim()) return { ok: false, errors: ["missing-input-response"] };

  const body = new URLSearchParams({ secret, response: token.trim() });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    return { ok: data.success === true, errors: data["error-codes"] ?? [] };
  } catch (error) {
    console.error("[auth] Turnstile verification request failed:", error instanceof Error ? error.message : error);
    return { ok: false, errors: ["verification-unavailable"] };
  }
}
