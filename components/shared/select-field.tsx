"use client";

import { useMemo } from "react";
import { cn } from "cn";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SelectOption } from "@/components/shared/options";

interface SelectFieldProps {
  id?: string;
  /** When set, a hidden input is rendered so the value submits with plain forms. */
  name?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  size?: "sm" | "default";
}

/**
 * Themed dropdown built on the shadcn Select. Replaces native <select> so the
 * open list and the highlighted item follow the app theme instead of the
 * browser's own (often black) styling.
 */
export function SelectField({
  id,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  className,
  disabled,
  invalid,
  size = "default",
}: SelectFieldProps) {
  const items = useMemo(() => options.map((o) => ({ value: o.value, label: o.label })), [options]);

  return (
    <Select
      items={items}
      name={name}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={(next) => onValueChange?.(next == null ? "" : String(next))}
    >
      <SelectTrigger id={id} size={size} className={cn("w-full", className)} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Open as a true dropdown below the field instead of overlaying the trigger. */}
      <SelectContent alignItemWithTrigger={false} side="bottom" align="start" sideOffset={4}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
