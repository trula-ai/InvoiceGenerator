"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, FileText, Search, Users, Wallet } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { searchAction, type SearchKind, type SearchResponse } from "@/lib/actions/search";
import { documentLabel, documentPath } from "@/lib/documents";
import { formatCurrency, formatDate } from "@/lib/format";

type ResultOf<K extends SearchKind> = Extract<SearchResponse, { kind: K }>["results"][number];

const KIND_LABELS: Record<SearchKind, string> = {
  invoice: "invoices",
  client: "clients",
  payment: "payments",
  history: "transactions",
};

/** Where a suggestion leads when chosen. Payments have no page of their own, so they open their invoice. */
export function resultHref(kind: SearchKind, item: ResultOf<SearchKind>): string {
  switch (kind) {
    case "client":
      return `/dashboard/clients/${(item as ResultOf<"client">).id}`;
    case "payment":
      return `/dashboard/invoices/${(item as ResultOf<"payment">).invoiceId}`;
    case "history":
      return (item as ResultOf<"history">).href;
    default: {
      const inv = item as ResultOf<"invoice">;
      return documentPath(inv.documentKind, inv.id);
    }
  }
}

/**
 * Debounced prefix lookup for a search box. Results reset when the query is
 * cleared and stale responses are discarded when the kind or query changes.
 */
export function useSearchSuggestions(kind: SearchKind, query: string) {
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      requestId.current += 1;
      const id = window.setTimeout(() => setResponse(null), 0);
      return () => window.clearTimeout(id);
    }
    const current = ++requestId.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await searchAction({ kind, q });
        if (current === requestId.current) setResponse(result);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, kind]);

  const results: ResultOf<SearchKind>[] = response && response.kind === kind ? response.results : [];
  return { results, pending, reset: () => setResponse(null) };
}

const rowClass = "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm";

/** One suggestion row, laid out per record kind. */
export function SearchResultRow({ kind, item }: { kind: SearchKind; item: ResultOf<SearchKind> }) {
  if (kind === "client") {
    const c = item as ResultOf<"client">;
    return (
      <>
        <Users className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{c.name}</span>
          {c.email ? <span className="block truncate text-xs text-muted-foreground">{c.email}</span> : null}
        </span>
        <Badge variant="secondary" className="uppercase">
          {c.type}
        </Badge>
      </>
    );
  }
  if (kind === "payment") {
    const p = item as ResultOf<"payment">;
    return (
      <>
        <Wallet className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{p.receiptNumber}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {p.clientName} · {p.invoiceNumber} · {formatDate(p.paymentDate)}
            {p.reference ? ` · ${p.reference}` : ""}
          </span>
        </span>
        <span className="text-xs font-medium tabular-nums">{formatCurrency(p.amount, p.currency)}</span>
      </>
    );
  }
  if (kind === "history") {
    const e = item as ResultOf<"history">;
    const isPayment = e.kind === "payment";
    return (
      <>
        {isPayment ? <ArrowDownLeft className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {e.reference}
            {e.relatedReference ? <span className="font-normal text-muted-foreground"> for {e.relatedReference}</span> : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {e.clientName} · {formatDate(e.date)}
          </span>
        </span>
        <span className="text-right text-xs tabular-nums">
          <span className={cn("block font-medium", isPayment && "text-emerald-600 dark:text-emerald-400")}>
            {isPayment ? "+" : ""}
            {formatCurrency(e.amount, e.currency)}
          </span>
          <Badge variant={isPayment ? "default" : "outline"} className="mt-0.5">
            {isPayment ? "Payment" : "Invoice"}
          </Badge>
        </span>
      </>
    );
  }
  const inv = item as ResultOf<"invoice">;
  return (
    <>
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{inv.invoiceNumber}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {inv.documentKind !== "invoice" ? `${documentLabel(inv.documentKind)} · ` : ""}
          {inv.clientName} · {formatDate(inv.issueDate)}
        </span>
      </span>
      <span className="text-right text-xs tabular-nums">
        <span className="block font-medium">{formatCurrency(inv.total, inv.currency)}</span>
        <StatusBadge status={inv.status} kind={inv.documentKind} className="mt-0.5" />
      </span>
    </>
  );
}

export interface SearchSuggestListProps {
  id: string;
  kind: SearchKind;
  query: string;
  results: ResultOf<SearchKind>[];
  pending: boolean;
  active: number;
  onHover: (index: number) => void;
  onPick: (href: string) => void;
  footer: React.ReactNode;
  className?: string;
}

/** The dropdown of suggestions shared by every search box. */
export function SearchSuggestList({ id, kind, query, results, pending, active, onHover, onPick, footer, className }: SearchSuggestListProps) {
  return (
    <div
      id={id}
      role="listbox"
      className={cn(
        "absolute top-full left-0 z-50 mt-1.5 w-full min-w-80 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
        className,
      )}
    >
      {results.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{pending ? "Searching…" : `No ${KIND_LABELS[kind]} starting with “${query.trim()}”.`}</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto p-1">
          {results.map((item, i) => (
            <li key={`${kind}-${(item as { id: string }).id}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => onHover(i)}
                onClick={() => onPick(resultHref(kind, item))}
                className={cn(rowClass, i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60")}
              >
                <SearchResultRow kind={kind} item={item} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">{footer}</div>
    </div>
  );
}

export interface SearchSuggestInputProps {
  kind: SearchKind;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Search box for the list pages. Typing shows prefix matches in a dropdown;
 * picking one opens that record, while Enter with nothing highlighted submits
 * the surrounding filter form as before.
 */
export function SearchSuggestInput({ kind, name = "q", defaultValue = "", placeholder, className }: SearchSuggestInputProps) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { results, pending } = useSearchSuggestions(kind, query);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const showList = open && query.trim().length > 0;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (event.key === "Enter") {
      const item = active >= 0 ? results[active] : undefined;
      if (item) {
        event.preventDefault();
        go(resultHref(kind, item));
      }
      // Otherwise let the form submit and filter the list.
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name={name}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="pl-8 pr-8"
        autoComplete="off"
      />
      {pending ? <Spinner className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" /> : null}
      {showList ? (
        <SearchSuggestList
          id={listId}
          kind={kind}
          query={query}
          results={results}
          pending={pending}
          active={active}
          onHover={setActive}
          onPick={go}
          footer="Enter to filter the list · ↑↓ then Enter to open a result · Esc to close"
        />
      ) : null}
    </div>
  );
}
