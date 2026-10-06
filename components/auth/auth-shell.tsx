import Link from "next/link";
import { CheckCircle2, FileText, Globe2, Lock, Mail, Receipt, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { appConfig } from "@/lib/config";

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const HIGHLIGHTS = [
  { icon: FileText, title: "GST-ready invoices", text: "Automatic numbering per financial year with CGST, SGST and IGST handled for you." },
  { icon: Globe2, title: "Bill in any currency", text: "INR, USD, EUR, GBP and AED with live rates frozen on every invoice." },
  { icon: Mail, title: "Send and get paid", text: "Email branded PDFs, send reminders, record payments and share a public invoice link." },
];

const TRUST = [
  { icon: Lock, text: "Encrypted sessions" },
  { icon: ShieldCheck, text: "Your own database" },
  { icon: Sparkles, text: "No credit card needed" },
];

/**
 * Split layout shared by the auth pages: a brand panel with a product preview
 * on the left (desktop only) and the form card on the right.
 */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="grid min-h-dvh flex-1 lg:h-dvh lg:grid-cols-[1.1fr_1fr] lg:overflow-hidden">
      {/* Brand panel: fixed to the viewport height; the feature list is dropped on short screens so it never scrolls. */}
      <section className="relative hidden min-h-0 overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-white/10 blur-3xl motion-safe:animate-[auth-blob_18s_ease-in-out_infinite]" />
          <div className="absolute -right-24 bottom-0 size-[24rem] rounded-full bg-black/20 blur-3xl motion-safe:animate-[auth-blob_22s_ease-in-out_infinite_reverse]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse at top left, black 30%, transparent 75%)",
            }}
          />
        </div>

        <BrandMark className="relative" />

        <div className="relative my-6 flex min-h-0 flex-col gap-6 xl:my-8 xl:gap-8">
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
            <h2 className="max-w-md text-3xl font-semibold tracking-tight text-balance xl:text-4xl">Invoicing that looks as professional as your work.</h2>
            <p className="mt-3 max-w-md text-base text-primary-foreground/75">
              Create, send and track invoices from one place, with the tax and currency details taken care of.
            </p>
          </div>

          <InvoicePreview />

          <ul className="grid gap-3 animate-in fade-in-0 slide-in-from-bottom-4 delay-200 duration-700 [@media(max-height:900px)]:hidden">
            {HIGHLIGHTS.map((h, i) => (
              <li
                key={h.title}
                className="group flex items-start gap-3 rounded-xl p-2 -m-2 transition-colors hover:bg-white/5 animate-in fade-in-0 slide-in-from-left-2 fill-mode-both"
                style={{ animationDelay: `${300 + i * 120}ms`, animationDuration: "600ms" }}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 transition-transform group-hover:scale-110">
                  <h.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{h.title}</span>
                  <span className="block text-sm text-primary-foreground/70">{h.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="relative flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-primary-foreground/60">
          {TRUST.map((t) => (
            <li key={t.text} className="flex items-center gap-1.5">
              <t.icon className="size-3.5" /> {t.text}
            </li>
          ))}
        </ul>
      </section>

      {/* Form panel */}
      <section className="relative flex min-h-0 items-center justify-center bg-muted/40 px-4 py-8 sm:px-8 lg:overflow-y-auto">
        <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <BrandMark className="mb-8 lg:hidden" compact />
          <div className="rounded-xl bg-card p-6 shadow-neu ring-1 ring-foreground/10 sm:p-8">
            <div className="mb-6 flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
          </div>
          <p className="mt-5 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </section>
    </main>
  );
}

/**
 * Product wordmark. The brand panel version is deliberately large: it is the
 * first thing on the page and anchors the layout.
 */
function BrandMark({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <Link href="/" className={`flex items-center gap-3 ${className}`}>
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-neu">
          <Receipt className="size-5" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-xl font-semibold tracking-tight">{appConfig.name}</span>
          <span className="text-xs text-muted-foreground">GST-ready billing for your business</span>
        </span>
      </Link>
    );
  }
  return (
    <Link href="/" className={`group inline-flex w-fit items-center gap-4 ${className}`}>
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
        <Receipt className="size-7" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-3xl font-semibold tracking-tight">{appConfig.name}</span>
        <span className="text-sm text-primary-foreground/70">GST-ready billing for your business</span>
      </span>
    </Link>
  );
}

/** Decorative, static invoice mock-up used on the brand panel. */
function InvoicePreview() {
  return (
    <div className="group relative max-w-md animate-in fade-in-0 zoom-in-95 delay-100 duration-700 [perspective:1200px]">
      <div className="rounded-xl bg-background p-5 pb-12 text-foreground shadow-2xl ring-1 ring-black/10 transition-transform duration-500 motion-safe:animate-[auth-float_7s_ease-in-out_infinite] group-hover:[transform:rotateX(4deg)_rotateY(-6deg)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tax invoice</p>
            <p className="font-mono text-sm font-semibold">INV/2026-27/0042</p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Paid
          </Badge>
        </div>
        <div className="mt-4 divide-y text-sm">
          <Row label="Design retainer · October" value="₹45,000.00" />
          <Row label="Brand guidelines" value="₹18,500.00" />
          <Row label="CGST 9% + SGST 9%" value="₹11,430.00" muted />
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">₹74,930.00</span>
        </div>
      </div>

      <div className="absolute right-4 bottom-2 flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs text-foreground shadow-xl ring-1 ring-black/10 animate-in fade-in-0 slide-in-from-left-2 delay-500 duration-700 motion-safe:animate-[auth-float_7s_ease-in-out_1.5s_infinite]">
        <CheckCircle2 className="size-4 text-emerald-500" />
        <span>
          <span className="block font-medium">Payment received</span>
          <span className="text-muted-foreground">RCPT/2026-27/0031 · Bank transfer</span>
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
