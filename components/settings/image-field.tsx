"use client";

import { useId, useRef } from "react";
import { ImagePlus, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/format";

const MAX_BYTES = 300 * 1024;
const ACCEPTED = ["image/png", "image/jpeg"];

interface ImageFieldProps {
  /** Data URL or empty string. */
  value: string;
  onChange: (value: string) => void;
  /** "logo" shows a square tile with initials when empty; "signature" shows a wide tile with a pen icon. */
  kind: "logo" | "signature";
  /** Used for the initials placeholder and alt text of a logo. */
  businessName?: string;
}

/**
 * Picks a small PNG/JPEG and stores it as a data URL on the form so it can be
 * saved in the business row and embedded straight into PDFs. Used for the
 * business logo and the authorised-signatory signature.
 */
export function ImageField({ value, onChange, kind, businessName = "" }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const noun = kind === "logo" ? "logo" : "signature";

  function pick(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please choose a PNG or JPEG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`That image is too large. Keep the ${noun} under 300 KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10 ${kind === "logo" ? "size-16" : "h-16 w-36"}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={kind === "logo" ? `${businessName} logo` : "Signature"} className="size-full object-contain p-1" />
        ) : kind === "logo" ? (
          <span className="text-lg font-semibold text-muted-foreground">{getInitials(businessName) || "?"}</span>
        ) : (
          <PenLine className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <ImagePlus /> {value ? `Replace ${noun}` : `Upload ${noun}`}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <Trash2 /> Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
