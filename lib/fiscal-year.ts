/**
 * Indian financial year helpers. The FY runs 1 April to 31 March and is
 * labelled "YYYY-YY", e.g. 1 Apr 2026 .. 31 Mar 2027 => "2026-27".
 *
 * Dates are handled as ISO strings (YYYY-MM-DD) to avoid timezone drift
 * between the server and the database `date` column.
 */

export function financialYearFor(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  const startYear = month >= 4 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${endYear.toString().padStart(2, "0")}`;
}

/** Returns the inclusive ISO date range of a financial year label like "2026-27". */
export function financialYearRange(label: string): { from: string; to: string } {
  const startYear = Number(label.slice(0, 4));
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

export function currentFinancialYear(now = new Date()): string {
  return financialYearFor(toIsoDate(now));
}

/** YYYY-MM-DD in the server's local time. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function isPastDate(isoDate: string, today = todayIso()): boolean {
  return isoDate < today;
}
