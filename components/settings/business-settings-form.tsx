"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing, Building2, ChevronDown, FileText, MapPin, Receipt, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_OPTIONS, INDIA_STATE_OPTIONS } from "@/components/shared/options";
import { SelectField } from "@/components/shared/select-field";
import { LogoField } from "@/components/settings/logo-field";
import type { Business } from "@/db/schema";
import { updateSettingsAction } from "@/lib/actions/settings";
import { currentFinancialYear } from "@/lib/fiscal-year";
import { businessSettingsSchema, type BusinessSettingsInput, type BusinessSettingsValues } from "@/lib/validation/settings";

type SectionId = "profile" | "address" | "tax" | "invoice" | "reminders";

/** Which form fields belong to which section, used to open a section that has errors. */
const SECTION_FIELDS: Record<SectionId, (keyof BusinessSettingsInput)[]> = {
  profile: ["name", "legalName", "email", "phone", "website", "pan", "logoDataUrl"],
  address: ["addressLine1", "addressLine2", "city", "postalCode", "country", "stateCode", "state"],
  tax: ["gstEnabled", "gstin"],
  invoice: ["invoicePrefix", "defaultCurrency", "paymentTermsDays", "bankDetails", "invoiceNotes", "invoiceTerms"],
  reminders: ["remindersEnabled", "reminderDaysBefore", "reminderOverdueEveryDays"],
};

function sectionWithErrors(errors: FieldErrors<BusinessSettingsInput>): SectionId | null {
  for (const [id, fields] of Object.entries(SECTION_FIELDS) as [SectionId, (keyof BusinessSettingsInput)[]][]) {
    if (fields.some((f) => errors[f])) return id;
  }
  return null;
}

export function BusinessSettingsForm({ business }: { business: Business }) {
  const [openSection, setOpenSection] = useState<SectionId | null>("profile");
  const sectionsRef = useRef<HTMLDivElement>(null);

  // Collapse the open section when the user clicks anywhere outside it.
  // Clicks inside floating layers (select lists, date pickers) count as inside.
  useEffect(() => {
    if (!openSection) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest("[data-slot=select-content], [data-slot=popover-content], [data-slot=dialog-content], [data-sonner-toaster]")) return;
      const openCard = sectionsRef.current?.querySelector(`[data-section="${openSection}"]`);
      if (openCard && !openCard.contains(target)) setOpenSection(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openSection]);

  const form = useForm<BusinessSettingsInput, unknown, BusinessSettingsValues>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      name: business.name,
      legalName: business.legalName ?? "",
      email: business.email ?? "",
      phone: business.phone ?? "",
      website: business.website ?? "",
      addressLine1: business.addressLine1 ?? "",
      addressLine2: business.addressLine2 ?? "",
      city: business.city ?? "",
      state: business.state ?? "",
      stateCode: business.stateCode ?? "",
      postalCode: business.postalCode ?? "",
      country: business.country,
      gstEnabled: business.gstEnabled,
      gstin: business.gstin ?? "",
      pan: business.pan ?? "",
      defaultCurrency: business.defaultCurrency,
      invoicePrefix: business.invoicePrefix,
      paymentTermsDays: business.paymentTermsDays,
      bankDetails: business.bankDetails ?? "",
      invoiceNotes: business.invoiceNotes ?? "",
      invoiceTerms: business.invoiceTerms ?? "",
      logoDataUrl: business.logoDataUrl ?? "",
      remindersEnabled: business.remindersEnabled,
      reminderDaysBefore: business.reminderDaysBefore,
      reminderOverdueEveryDays: business.reminderOverdueEveryDays,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const gstEnabled = useWatch({ control: form.control, name: "gstEnabled" });
  const country = useWatch({ control: form.control, name: "country" });
  const prefix = useWatch({ control: form.control, name: "invoicePrefix" }) || "INV";
  const name = useWatch({ control: form.control, name: "name" });
  const city = useWatch({ control: form.control, name: "city" });
  const defaultCurrency = useWatch({ control: form.control, name: "defaultCurrency" });
  const remindersEnabled = useWatch({ control: form.control, name: "remindersEnabled" });
  const reminderDaysBefore = useWatch({ control: form.control, name: "reminderDaysBefore" });
  const reminderOverdueEveryDays = useWatch({ control: form.control, name: "reminderOverdueEveryDays" });
  const isIndia = (country ?? "").trim().toLowerCase() === "india";
  const reminderSummary = remindersEnabled
    ? [
        Number(reminderDaysBefore) > 0 ? `${reminderDaysBefore} days before` : null,
        "on the due date",
        Number(reminderOverdueEveryDays) > 0 ? `every ${reminderOverdueEveryDays} days overdue` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Automatic reminders off";

  const onSubmit = form.handleSubmit(
    async (values) => {
      const result = await updateSettingsAction(values);
      if (result.ok) toast.success("Settings saved");
      else toast.error(result.error);
    },
    (invalid) => {
      const section = sectionWithErrors(invalid);
      if (section) setOpenSection(section);
      toast.error("Please fix the highlighted fields.");
    },
  );

  const toggle = (id: SectionId) => setOpenSection((current) => (current === id ? null : id));

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-3">
      <div ref={sectionsRef} className="flex flex-col gap-3 xl:col-span-2">
        <Section
          id="profile"
          icon={Building2}
          title="Business profile"
          description="Shown in the header of every invoice and receipt."
          summary={name || "Not set"}
          open={openSection === "profile"}
          hasError={sectionWithErrors(errors) === "profile"}
          onToggle={toggle}
        >
          <FieldGroup>
            <Field data-invalid={!!errors.logoDataUrl}>
              <FieldLabel>Logo</FieldLabel>
              <Controller
                control={form.control}
                name="logoDataUrl"
                render={({ field }) => <LogoField value={field.value ?? ""} onChange={field.onChange} businessName={name || business.name} />}
              />
              <FieldDescription>PNG or JPEG up to 300 KB. Printed on invoice and receipt PDFs and shown on the public invoice page.</FieldDescription>
              <FieldError errors={[errors.logoDataUrl]} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">Business name</FieldLabel>
                <Input id="name" {...form.register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.legalName}>
                <FieldLabel htmlFor="legalName">Legal name</FieldLabel>
                <Input id="legalName" {...form.register("legalName")} />
              </Field>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Billing email</FieldLabel>
                <Input id="email" type="email" {...form.register("email")} />
                <FieldDescription>Used as the reply-to address on invoice emails.</FieldDescription>
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <Input id="phone" {...form.register("phone")} />
              </Field>
              <Field data-invalid={!!errors.website}>
                <FieldLabel htmlFor="website">Website</FieldLabel>
                <Input id="website" {...form.register("website")} />
              </Field>
              <Field data-invalid={!!errors.pan}>
                <FieldLabel htmlFor="pan">PAN</FieldLabel>
                <Input id="pan" className="uppercase" {...form.register("pan")} />
              </Field>
            </div>
          </FieldGroup>
        </Section>

        <Section
          id="address"
          icon={MapPin}
          title="Address"
          description="Printed on documents and used to determine the GST state."
          summary={[city, isIndia ? undefined : country].filter(Boolean).join(", ") || "Not set"}
          open={openSection === "address"}
          hasError={sectionWithErrors(errors) === "address"}
          onToggle={toggle}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="addressLine1">Address line 1</FieldLabel>
              <Input id="addressLine1" {...form.register("addressLine1")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="addressLine2">Address line 2</FieldLabel>
              <Input id="addressLine2" {...form.register("addressLine2")} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="city">City</FieldLabel>
                <Input id="city" {...form.register("city")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="postalCode">Postal code</FieldLabel>
                <Input id="postalCode" {...form.register("postalCode")} />
              </Field>
              <Field data-invalid={!!errors.country}>
                <FieldLabel htmlFor="country">Country</FieldLabel>
                <Input id="country" {...form.register("country")} />
                <FieldError errors={[errors.country]} />
              </Field>
              {isIndia ? (
                <Field data-invalid={!!errors.stateCode}>
                  <FieldLabel htmlFor="stateCode">State</FieldLabel>
                  <Controller
                    control={form.control}
                    name="stateCode"
                    render={({ field }) => (
                      <SelectField
                        id="stateCode"
                        options={INDIA_STATE_OPTIONS}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select state"
                        invalid={!!errors.stateCode}
                      />
                    )}
                  />
                  <FieldDescription>Your GST state. Supplies to other states are charged IGST.</FieldDescription>
                  <FieldError errors={[errors.stateCode]} />
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="state">State / region</FieldLabel>
                  <Input id="state" {...form.register("state")} />
                </Field>
              )}
            </div>
          </FieldGroup>
        </Section>

        <Section
          id="tax"
          icon={Receipt}
          title="Tax (GST)"
          description="Turn GST off if your business is not registered; invoices then use a plain per-item tax rate."
          summary={gstEnabled ? "GST enabled" : "GST disabled"}
          open={openSection === "tax"}
          hasError={sectionWithErrors(errors) === "tax"}
          onToggle={toggle}
        >
          <FieldGroup>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="gstEnabled"
                render={({ field }) => <Switch id="gstEnabled" checked={field.value} onCheckedChange={(checked) => field.onChange(checked)} />}
              />
              <FieldLabel htmlFor="gstEnabled">GST enabled</FieldLabel>
            </Field>
            {gstEnabled ? (
              <Field data-invalid={!!errors.gstin}>
                <FieldLabel htmlFor="gstin">GSTIN</FieldLabel>
                <Input id="gstin" className="uppercase" placeholder="22AAAAA0000A1Z5" {...form.register("gstin")} />
                <FieldDescription>Printed on tax invoices. Required while GST is enabled.</FieldDescription>
                <FieldError errors={[errors.gstin]} />
              </Field>
            ) : null}
          </FieldGroup>
        </Section>

        <Section
          id="invoice"
          icon={FileText}
          title="Invoice defaults"
          description="Numbering, currency, payment terms and the text printed on every invoice."
          summary={`${prefix.toUpperCase()}/${currentFinancialYear()}/… · ${defaultCurrency}`}
          open={openSection === "invoice"}
          hasError={sectionWithErrors(errors) === "invoice"}
          onToggle={toggle}
        >
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field data-invalid={!!errors.invoicePrefix}>
                <FieldLabel htmlFor="invoicePrefix">Number prefix</FieldLabel>
                <Input id="invoicePrefix" className="uppercase" {...form.register("invoicePrefix")} />
                <FieldDescription>
                  Next format: {prefix.toUpperCase()}/{currentFinancialYear()}/0001
                </FieldDescription>
                <FieldError errors={[errors.invoicePrefix]} />
              </Field>
              <Field data-invalid={!!errors.defaultCurrency}>
                <FieldLabel htmlFor="defaultCurrency">Default currency</FieldLabel>
                <Controller
                  control={form.control}
                  name="defaultCurrency"
                  render={({ field }) => (
                    <SelectField id="defaultCurrency" options={CURRENCY_OPTIONS} value={field.value ?? "INR"} onValueChange={field.onChange} />
                  )}
                />
              </Field>
              <Field data-invalid={!!errors.paymentTermsDays}>
                <FieldLabel htmlFor="paymentTermsDays">Payment terms (days)</FieldLabel>
                <Input id="paymentTermsDays" type="number" min={0} max={365} {...form.register("paymentTermsDays")} />
                <FieldError errors={[errors.paymentTermsDays]} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="bankDetails">Payment details</FieldLabel>
              <Textarea id="bankDetails" rows={4} placeholder={"Bank: …\nAccount: …\nIFSC: …\nUPI: …"} {...form.register("bankDetails")} />
              <FieldDescription>Printed on every invoice and included in invoice emails.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="invoiceNotes">Default notes</FieldLabel>
              <Textarea id="invoiceNotes" rows={2} {...form.register("invoiceNotes")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="invoiceTerms">Default terms</FieldLabel>
              <Textarea id="invoiceTerms" rows={3} {...form.register("invoiceTerms")} />
            </Field>
          </FieldGroup>
        </Section>

        <Section
          id="reminders"
          icon={BellRing}
          title="Payment reminders"
          description="Reminder emails are sent automatically to clients with unpaid invoices. Manual sends from the invoice and client pages are always available."
          summary={reminderSummary}
          open={openSection === "reminders"}
          hasError={sectionWithErrors(errors) === "reminders"}
          onToggle={toggle}
        >
          <FieldGroup>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="remindersEnabled"
                render={({ field }) => <Switch id="remindersEnabled" checked={field.value} onCheckedChange={(checked) => field.onChange(checked)} />}
              />
              <FieldLabel htmlFor="remindersEnabled">Send automatic reminders</FieldLabel>
            </Field>
            {remindersEnabled ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={!!errors.reminderDaysBefore}>
                  <FieldLabel htmlFor="reminderDaysBefore">Remind before due date (days)</FieldLabel>
                  <Input id="reminderDaysBefore" type="number" min={0} max={60} {...form.register("reminderDaysBefore")} />
                  <FieldDescription>One due-soon email this many days ahead. 0 turns it off.</FieldDescription>
                  <FieldError errors={[errors.reminderDaysBefore]} />
                </Field>
                <Field data-invalid={!!errors.reminderOverdueEveryDays}>
                  <FieldLabel htmlFor="reminderOverdueEveryDays">Repeat when overdue (every N days)</FieldLabel>
                  <Input id="reminderOverdueEveryDays" type="number" min={0} max={90} {...form.register("reminderOverdueEveryDays")} />
                  <FieldDescription>An overdue nudge every N days after the due date. 0 turns it off.</FieldDescription>
                  <FieldError errors={[errors.reminderOverdueEveryDays]} />
                </Field>
              </div>
            ) : null}
            <FieldDescription>
              A reminder is always sent on the due date itself. Clients can be excluded individually from their client settings. The schedule runs
              when the dashboard is opened and via the daily cron route.
            </FieldDescription>
          </FieldGroup>
        </Section>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle>Save</CardTitle>
            <CardDescription>Changes apply to new invoices only. Existing invoices keep the details they were issued with.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null} Save settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

interface SectionProps {
  id: SectionId;
  icon: LucideIcon;
  title: string;
  description: string;
  /** One-line summary shown while collapsed. */
  summary: string;
  open: boolean;
  hasError: boolean;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}

/**
 * Collapsible settings card. One section open at a time; the open one closes on
 * a second header click or a click outside. Content stays mounted (so form
 * values persist) and the height animates via the grid-rows trick.
 */
function Section({ id, icon: Icon, title, description, summary, open, hasError, onToggle, children }: SectionProps) {
  const panelId = `settings-${id}`;
  return (
    <Card data-section={id} className={cn("gap-0 py-0 transition-shadow duration-300", open && "shadow-neu")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          open && "rounded-b-none",
        )}
      >
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary", hasError && "bg-destructive/10 text-destructive")}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-heading text-base font-medium">{title}</span>
            {hasError ? <span className="text-xs text-destructive">Needs attention</span> : null}
          </span>
          <span className="block truncate text-sm text-muted-foreground">{open ? description : summary}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <div
        id={panelId}
        className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="min-h-0 overflow-hidden" inert={!open} aria-hidden={!open}>
          <div className="border-t px-4 py-5">{children}</div>
        </div>
      </div>
    </Card>
  );
}
