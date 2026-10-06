"use client";

import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toIsoDate } from "@/lib/fiscal-year";
import { formatDate } from "@/lib/format";

interface DatePickerProps {
  id?: string;
  /** When set, a hidden input is rendered so the value submits with plain forms. */
  name?: string;
  /** ISO date (YYYY-MM-DD). Controlled when provided. */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Show a clear action (for optional filter dates). */
  allowClear?: boolean;
}

function parseIso(iso: string | undefined): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const START_MONTH = new Date(2015, 0, 1);
const END_MONTH = new Date(2040, 11, 1);

/**
 * Themed date picker (shadcn Calendar in a Popover). Replaces native
 * <input type="date"> so the calendar and the selected day follow the app
 * theme instead of the browser's own styling.
 */
export function DatePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  invalid,
  allowClear,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue ?? "");
  const iso = value ?? internal;
  const selected = parseIso(iso);

  function commit(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? <input type="hidden" name={name} value={iso} /> : null}
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            className={cn("w-full justify-start gap-2 font-normal", !selected && "text-muted-foreground", className)}
          />
        }
      >
        <CalendarIcon className="size-4 text-muted-foreground" />
        <span className="flex-1 truncate text-left">{selected ? formatDate(iso) : placeholder}</span>
        {allowClear && selected ? (
          <span
            role="button"
            aria-label="Clear date"
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              commit("");
            }}
          >
            <X className="size-3.5" />
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          captionLayout="dropdown"
          startMonth={START_MONTH}
          endMonth={END_MONTH}
          onSelect={(day) => {
            commit(day ? toIsoDate(day) : "");
            setOpen(false);
          }}
        />
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              commit(toIsoDate(new Date()));
              setOpen(false);
            }}
          >
            Today
          </Button>
          {allowClear ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                commit("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
