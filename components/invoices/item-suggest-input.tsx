"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Package } from "lucide-react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";
import type { ItemOption } from "@/lib/data/items";
import { formatCurrency } from "@/lib/format";

interface ItemSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the user picks a catalog item; the caller fills the other columns. */
  onPick: (item: ItemOption) => void;
  catalog: ItemOption[];
  currency: string;
  invalid?: boolean;
  placeholder?: string;
}

const MAX_RESULTS = 8;

/**
 * Description input for an invoice line with catalog autocomplete. Typing
 * filters the business's saved items by name, description or HSN/SAC; picking
 * one hands the item back so the row can be filled in. Free text is always
 * allowed, so businesses without a catalog see a plain input.
 */
export function ItemSuggestInput({ value, onChange, onPick, catalog, currency, invalid, placeholder }: ItemSuggestInputProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (catalog.length === 0) return [];
    const q = value.trim().toLowerCase();
    const matches = q
      ? catalog.filter((i) => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) || i.hsnSac?.toLowerCase().includes(q))
      : catalog;
    return matches.slice(0, MAX_RESULTS);
  }, [catalog, value]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const showList = open && results.length > 0;

  function pick(item: ItemOption) {
    setOpen(false);
    setActive(-1);
    onPick(item);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!catalog.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (event.key === "Enter" && showList && active >= 0) {
      event.preventDefault();
      pick(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        role={catalog.length ? "combobox" : undefined}
        aria-expanded={catalog.length ? showList : undefined}
        aria-controls={catalog.length ? listId : undefined}
        aria-autocomplete={catalog.length ? "list" : undefined}
        aria-label="Description"
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-full left-0 z-50 mt-1.5 w-full min-w-80 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <ul className="max-h-72 overflow-y-auto p-1">
            {results.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm",
                    i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  )}
                >
                  <Package className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[item.hsnSac, item.unit, `${Number(item.taxRate).toFixed(0)}% tax`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-xs font-medium tabular-nums">{formatCurrency(item.unitPrice, currency)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">Pick an item to fill the line, or keep typing for free text.</div>
        </div>
      ) : null}
    </div>
  );
}
