"use server";

import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import {
  searchClients,
  searchHistory,
  searchInvoices,
  searchPayments,
  type ClientSearchResult,
  type HistorySearchResult,
  type InvoiceSearchResult,
  type PaymentSearchResult,
} from "@/lib/data/search";

const KINDS = ["invoice", "client", "payment", "history"] as const;

const schema = z.object({
  kind: z.enum(KINDS),
  q: z.string().trim().min(1).max(100),
});

export type SearchKind = (typeof KINDS)[number];

export type SearchResponse =
  | { kind: "client"; results: ClientSearchResult[] }
  | { kind: "invoice"; results: InvoiceSearchResult[] }
  | { kind: "payment"; results: PaymentSearchResult[] }
  | { kind: "history"; results: HistorySearchResult[] };

/** Prefix search for the type-ahead search boxes. Returns an empty list on invalid input. */
export async function searchAction(input: { kind: SearchKind; q: string }): Promise<SearchResponse> {
  const { business } = await requireUser();
  const parsed = schema.safeParse(input);
  const kind: SearchKind = KINDS.includes(input.kind) ? input.kind : "invoice";
  if (!parsed.success) return { kind, results: [] } as SearchResponse;

  switch (parsed.data.kind) {
    case "client":
      return { kind: "client", results: await searchClients(business.id, parsed.data.q) };
    case "payment":
      return { kind: "payment", results: await searchPayments(business.id, parsed.data.q) };
    case "history":
      return { kind: "history", results: await searchHistory(business.id, parsed.data.q) };
    default:
      return { kind: "invoice", results: await searchInvoices(business.id, parsed.data.q) };
  }
}
