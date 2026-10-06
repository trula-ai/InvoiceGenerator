/** Absolute URLs used inside emails. Falls back to localhost in development. */
export function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return configured || "http://localhost:3000";
}

/** Public, no-login invoice page for a share token. */
export function publicInvoicePath(token: string): string {
  return `/i/${token}`;
}

export function publicInvoiceUrl(token: string): string {
  return `${appBaseUrl()}${publicInvoicePath(token)}`;
}
