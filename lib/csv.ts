/**
 * Dependency-free CSV helpers shared by the `/api/export/*` route handlers.
 *
 * Output follows RFC 4180: fields containing a comma, double quote, CR or LF
 * are wrapped in double quotes with embedded quotes doubled, records are
 * joined with CRLF, and the document is prefixed with a UTF-8 BOM so Excel
 * decodes "₹" and accented characters correctly.
 */

export type CsvValue = string | number | null | undefined;

const UTF8_BOM = "﻿";

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value) : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(","));
  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/** Wraps a CSV document in a download response that browsers will not cache. */
export function csvResponse(filename: string, csv: string): Response {
  const safeName = filename.replace(/["\\\r\n]/g, "_");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Builds the href for an export link from already-parsed page filters.
 * Undefined or empty values are omitted so the route sees exactly the
 * filters the page applied.
 */
export function exportHref(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
