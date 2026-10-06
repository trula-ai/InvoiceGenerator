"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SelectField } from "@/components/shared/select-field";
import { resultHref, SearchSuggestList, useSearchSuggestions } from "@/components/shared/search-suggest";
import type { SearchKind } from "@/lib/actions/search";

const KIND_OPTIONS = [
  { value: "invoice", label: "Invoices" },
  { value: "client", label: "Clients" },
];

/**
 * Header search with a kind selector (Invoices or Clients) and a type-ahead
 * dropdown of prefix matches. Enter opens the first match; clicking any row
 * navigates to it.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const [kind, setKind] = useState<SearchKind>("invoice");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { results, pending, reset } = useSearchSuggestions(kind, query);

  // Close when clicking anywhere outside the search box.
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
    setQuery("");
    reset();
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[active];
      if (item) go(resultHref(kind, item));
      else if (query.trim()) go(`${kind === "client" ? "/dashboard/clients" : "/dashboard/invoices"}?q=${encodeURIComponent(query.trim())}`);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative flex items-center gap-1.5", className)}>
      <SelectField
        options={KIND_OPTIONS}
        value={kind}
        onValueChange={(v) => {
          setKind(v === "client" ? "client" : "invoice");
          setActive(0);
          setOpen(true);
        }}
        size="sm"
        className="w-28 shrink-0"
      />
      <div className="relative w-56 lg:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={kind === "client" ? "Search clients" : "Search invoices"}
          placeholder={kind === "client" ? "Client name…" : "Invoice number or client…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="pl-8 pr-8"
          autoComplete="off"
        />
        {pending ? <Spinner className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" /> : null}
      </div>

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
          footer="Press Enter to open the highlighted result · Esc to close"
          className="left-auto right-0"
        />
      ) : null}
    </div>
  );
}
