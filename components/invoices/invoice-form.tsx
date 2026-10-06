"use client";

import { useMemo, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/shared/date-picker";
import {
  CURRENCY_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  INDIA_STATE_OPTIONS,
  INVOICE_TYPE_OPTIONS,
  type SelectOption,
} from "@/components/shared/options";
import { SelectField } from "@/components/shared/select-field";
import { createInvoiceAction, fetchExchangeRateAction, updateInvoiceAction } from "@/lib/actions/invoices";
import type { RateQuote } from "@/lib/data/exchange-rates";
import { calculateInvoice } from "@/lib/calculations";
import { BASE_CURRENCY } from "@/lib/currency";
import { addDaysIso, todayIso } from "@/lib/fiscal-year";
import { formatCurrency, formatDateTime, formatRate } from "@/lib/format";
import { invoiceSchema, type InvoiceFormInput, type InvoiceFormValues } from "@/lib/validation/invoice";

export interface ClientOption {
  id: string;
  name: string;
  type: "b2b" | "b2c";
  currency: string;
  stateCode: string | null;
  gstin: string | null;
  email: string | null;
  country: string;
}

export interface BusinessContext {
  gstEnabled: boolean;
  stateCode: string | null;
  defaultCurrency: string;
  paymentTermsDays: number;
  invoiceNotes: string | null;
  invoiceTerms: string | null;
}

interface InvoiceFormProps {
  mode: "create" | "edit";
  invoiceId?: string;
  /** Status of the invoice being edited (controls which submit buttons show). */
  currentStatus?: string;
  clients: ClientOption[];
  business: BusinessContext;
  defaultValues?: InvoiceFormInput;
  initialClientId?: string;
  /** Rate fetched server-side for the initial currency (create mode), if any. */
  initialRate?: RateQuote | null;
}

/** Keep calculations safe while the user is mid-typing. */
function num(value: string | undefined): string {
  return value && /^\d+(\.\d+)?$/.test(value) ? value : "0";
}

export function InvoiceForm({ mode, invoiceId, currentStatus, clients, business, defaultValues, initialClientId, initialRate }: InvoiceFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [rateInfo, setRateInfo] = useState<{ fetchedAt: Date | null; stale: boolean } | null>(
    initialRate && initialRate.source === "api" ? { fetchedAt: initialRate.fetchedAt, stale: initialRate.stale } : null,
  );
  const [rateLoading, startRateLoad] = useTransition();

  const today = todayIso();
  const initialClient = clients.find((c) => c.id === initialClientId);
  const initialCurrency = defaultValues?.currency ?? initialClient?.currency ?? business.defaultCurrency;
  const [manualRate, setManualRate] = useState(
    defaultValues ? defaultValues.exchangeRateSource === "manual" : initialCurrency !== BASE_CURRENCY && !initialRate,
  );

  const form = useForm<InvoiceFormInput, unknown, InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: defaultValues ?? {
      clientId: initialClient?.id ?? "",
      invoiceType: initialClient?.type ?? "b2b",
      issueDate: today,
      dueDate: addDaysIso(today, business.paymentTermsDays),
      currency: initialCurrency,
      exchangeRate: initialCurrency === BASE_CURRENCY ? "1" : (initialRate?.rate ?? ""),
      exchangeRateSource: initialCurrency === BASE_CURRENCY ? "base" : initialRate ? "api" : "manual",
      placeOfSupplyCode: initialClient?.stateCode ?? business.stateCode ?? "",
      discountType: "none",
      discountValue: "",
      notes: business.invoiceNotes ?? "",
      terms: business.invoiceTerms ?? "",
      items: [{ description: "", hsnSac: "", quantity: "1", unit: "", unitPrice: "", taxRate: business.gstEnabled ? "18" : "0" }],
      status: "pending",
    },
  });

  const { control, register, setValue, getValues, formState } = form;
  const { errors, isSubmitting } = formState;
  const items = useFieldArray({ control, name: "items" });

  const values = useWatch({ control });
  const currency = values.currency ?? business.defaultCurrency;
  const selectedClient = clients.find((c) => c.id === values.clientId);
  const isInterState = business.gstEnabled && !!values.placeOfSupplyCode && values.placeOfSupplyCode !== business.stateCode;

  const clientOptions = useMemo<SelectOption[]>(
    () => clients.map((c) => ({ value: c.id, label: `${c.name} · ${c.type.toUpperCase()} · ${c.currency}` })),
    [clients],
  );

  const totals = useMemo(() => {
    return calculateInvoice({
      items: (values.items ?? []).map((i) => ({ quantity: num(i.quantity), unitPrice: num(i.unitPrice), taxRate: num(i.taxRate) })),
      discountType: values.discountType ?? "none",
      discountValue: num(values.discountValue),
      gstEnabled: business.gstEnabled,
      isInterState,
      exchangeRate: num(values.exchangeRate) === "0" ? "1" : num(values.exchangeRate),
    });
  }, [values.items, values.discountType, values.discountValue, values.exchangeRate, business.gstEnabled, isInterState]);

  function loadRate(code: string) {
    if (code === BASE_CURRENCY) {
      setValue("exchangeRate", "1", { shouldValidate: true });
      setValue("exchangeRateSource", "base");
      setRateInfo(null);
      return;
    }
    startRateLoad(async () => {
      const result = await fetchExchangeRateAction(code);
      if (result.ok) {
        setValue("exchangeRate", result.data.rate, { shouldValidate: true });
        setValue("exchangeRateSource", "api");
        setRateInfo({ fetchedAt: result.data.fetchedAt, stale: result.data.stale });
        if (result.data.stale) toast.warning("Live rates are unavailable; using the last cached rate.");
      } else {
        toast.error(result.error);
        setManualRate(true);
        setValue("exchangeRateSource", "manual");
      }
    });
  }

  function onClientChange(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    setValue("clientId", clientId, { shouldValidate: true });
    if (!client) return;
    setValue("invoiceType", client.type);
    if (business.gstEnabled) setValue("placeOfSupplyCode", client.stateCode ?? business.stateCode ?? "");
    if (client.currency !== getValues("currency")) {
      setValue("currency", client.currency);
      if (!manualRate) loadRate(client.currency);
    }
  }

  function onCurrencyChange(code: string) {
    setValue("currency", code, { shouldValidate: true });
    if (code === BASE_CURRENCY) {
      setManualRate(false);
      loadRate(code);
    } else if (!manualRate) {
      loadRate(code);
    } else {
      setValue("exchangeRateSource", "manual");
    }
  }

  function toggleManual(checked: boolean) {
    setManualRate(checked);
    if (checked) {
      setValue("exchangeRateSource", "manual");
    } else {
      loadRate(getValues("currency"));
    }
  }

  const submit = form.handleSubmit(async (parsed) => {
    setServerError(null);
    const result = mode === "create" ? await createInvoiceAction(parsed) : await updateInvoiceAction(invoiceId!, parsed);
    if (result && !result.ok) {
      setServerError(result.error);
      toast.error(result.error);
    }
  });

  function submitWithStatus(status: "draft" | "pending") {
    setValue("status", status);
    void submit();
  }

  const isDraftEdit = mode === "edit" && currentStatus === "draft";

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="grid gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        {/* Client & dates */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
            <CardDescription>The invoice number and financial year are assigned automatically when you save.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={!!errors.clientId} className="sm:col-span-2">
                  <FieldLabel htmlFor="clientId">Client</FieldLabel>
                  <SelectField
                    id="clientId"
                    options={clientOptions}
                    value={values.clientId ?? ""}
                    onValueChange={onClientChange}
                    placeholder={clients.length ? "Select a client" : "No clients yet"}
                    invalid={!!errors.clientId}
                    disabled={clients.length === 0}
                  />
                  {clients.length === 0 ? <FieldDescription>You have no clients yet. Add one first.</FieldDescription> : null}
                  <FieldError errors={[errors.clientId]} />
                </Field>
                <Field data-invalid={!!errors.invoiceType}>
                  <FieldLabel htmlFor="invoiceType">Invoice type</FieldLabel>
                  <Controller
                    control={control}
                    name="invoiceType"
                    render={({ field }) => (
                      <SelectField id="invoiceType" options={INVOICE_TYPE_OPTIONS} value={field.value ?? "b2b"} onValueChange={field.onChange} />
                    )}
                  />
                  {business.gstEnabled && values.invoiceType === "b2b" && selectedClient && !selectedClient.gstin ? (
                    <FieldDescription className="text-amber-600 dark:text-amber-400">This client has no GSTIN on file.</FieldDescription>
                  ) : null}
                </Field>
                {business.gstEnabled ? (
                  <Field data-invalid={!!errors.placeOfSupplyCode}>
                    <FieldLabel htmlFor="placeOfSupplyCode">Place of supply</FieldLabel>
                    <Controller
                      control={control}
                      name="placeOfSupplyCode"
                      render={({ field }) => (
                        <SelectField
                          id="placeOfSupplyCode"
                          options={INDIA_STATE_OPTIONS}
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          placeholder="Select state"
                          invalid={!!errors.placeOfSupplyCode}
                        />
                      )}
                    />
                    <FieldDescription>
                      {values.placeOfSupplyCode ? (isInterState ? "Inter-state supply · IGST applies" : "Intra-state supply · CGST + SGST apply") : "Select to determine GST split"}
                    </FieldDescription>
                    <FieldError errors={[errors.placeOfSupplyCode]} />
                  </Field>
                ) : null}
                <Field data-invalid={!!errors.issueDate}>
                  <FieldLabel htmlFor="issueDate">Issue date</FieldLabel>
                  <Controller
                    control={control}
                    name="issueDate"
                    render={({ field }) => <DatePicker id="issueDate" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.issueDate} />}
                  />
                  <FieldError errors={[errors.issueDate]} />
                </Field>
                <Field data-invalid={!!errors.dueDate}>
                  <FieldLabel htmlFor="dueDate">Due date</FieldLabel>
                  <Controller
                    control={control}
                    name="dueDate"
                    render={({ field }) => <DatePicker id="dueDate" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.dueDate} />}
                  />
                  <FieldError errors={[errors.dueDate]} />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <CardDescription>Amounts are in {currency}. Tax is calculated per line.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="hidden grid-cols-[1fr_90px_80px_110px_70px_110px_32px] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
              <span>Description</span>
              <span>{business.gstEnabled ? "HSN / SAC" : "Code"}</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit price</span>
              <span className="text-right">Tax %</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {items.fields.map((field, index) => {
              const itemErrors = errors.items?.[index];
              return (
                <div key={field.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_90px_80px_110px_70px_110px_32px] md:items-start md:border-0 md:p-0">
                  <Field data-invalid={!!itemErrors?.description}>
                    <Input placeholder="Description" aria-label="Description" {...register(`items.${index}.description` as const)} />
                    <FieldError errors={[itemErrors?.description]} />
                  </Field>
                  <Field data-invalid={!!itemErrors?.hsnSac}>
                    <Input placeholder={business.gstEnabled ? "HSN/SAC" : "Code"} aria-label="HSN or SAC code" {...register(`items.${index}.hsnSac` as const)} />
                  </Field>
                  <Field data-invalid={!!itemErrors?.quantity}>
                    <Input inputMode="decimal" className="text-right" placeholder="1" aria-label="Quantity" {...register(`items.${index}.quantity` as const)} />
                    <FieldError errors={[itemErrors?.quantity]} />
                  </Field>
                  <Field data-invalid={!!itemErrors?.unitPrice}>
                    <Input inputMode="decimal" className="text-right" placeholder="0.00" aria-label="Unit price" {...register(`items.${index}.unitPrice` as const)} />
                    <FieldError errors={[itemErrors?.unitPrice]} />
                  </Field>
                  <Field data-invalid={!!itemErrors?.taxRate}>
                    <Input inputMode="decimal" className="text-right" placeholder="0" aria-label="Tax rate" {...register(`items.${index}.taxRate` as const)} />
                    <FieldError errors={[itemErrors?.taxRate]} />
                  </Field>
                  <div className="flex h-8 items-center justify-end text-sm font-medium tabular-nums">
                    {formatCurrency(totals.items[index]?.lineSubtotal ?? "0", currency)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove item"
                    disabled={items.fields.length === 1}
                    onClick={() => items.remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
            {typeof errors.items?.message === "string" ? <p className="text-sm text-destructive">{errors.items.message}</p> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => items.append({ description: "", hsnSac: "", quantity: "1", unit: "", unitPrice: "", taxRate: business.gstEnabled ? "18" : "0" })}
            >
              <Plus /> Add item
            </Button>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes & terms</CardTitle>
            <CardDescription>Printed at the bottom of the invoice.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" rows={3} {...register("notes")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="terms">Terms</FieldLabel>
                <Textarea id="terms" rows={3} {...register("terms")} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar: currency, discount, totals, actions */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Currency</CardTitle>
            <CardDescription>The rate is frozen on the invoice and never changes later.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.currency}>
                <FieldLabel htmlFor="currency">Invoice currency</FieldLabel>
                <SelectField id="currency" options={CURRENCY_OPTIONS} value={currency} onValueChange={onCurrencyChange} />
              </Field>
              {currency !== BASE_CURRENCY ? (
                <>
                  <Field data-invalid={!!errors.exchangeRate}>
                    <FieldLabel htmlFor="exchangeRate">1 {currency} in {BASE_CURRENCY}</FieldLabel>
                    <div className="flex gap-2">
                      <Input id="exchangeRate" inputMode="decimal" readOnly={!manualRate} className="tabular-nums" {...register("exchangeRate")} />
                      {!manualRate ? (
                        <Button type="button" variant="outline" size="icon" aria-label="Refresh rate" onClick={() => loadRate(currency)} disabled={rateLoading}>
                          {rateLoading ? <Spinner /> : <RefreshCw />}
                        </Button>
                      ) : null}
                    </div>
                    <FieldDescription>
                      {manualRate
                        ? "Manual rate."
                        : rateLoading
                          ? "Fetching live rate…"
                          : rateInfo?.fetchedAt
                            ? `${rateInfo.stale ? "Cached" : "Live"} rate from ${formatDateTime(rateInfo.fetchedAt)}`
                            : values.exchangeRate
                              ? `Rate: ${formatRate(values.exchangeRate)}`
                              : "No rate yet."}
                    </FieldDescription>
                    <FieldError errors={[errors.exchangeRate]} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" checked={manualRate} onChange={(e) => toggleManual(e.target.checked)} />
                    Enter exchange rate manually
                  </label>
                </>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="discountType">Type</FieldLabel>
                <Controller
                  control={control}
                  name="discountType"
                  render={({ field }) => (
                    <SelectField id="discountType" options={DISCOUNT_TYPE_OPTIONS} value={field.value ?? "none"} onValueChange={field.onChange} />
                  )}
                />
              </Field>
              <Field data-invalid={!!errors.discountValue}>
                <FieldLabel htmlFor="discountValue">{values.discountType === "percent" ? "Percent" : "Amount"}</FieldLabel>
                <Input id="discountValue" inputMode="decimal" disabled={values.discountType === "none"} className="text-right" {...register("discountValue")} />
                <FieldError errors={[errors.discountValue]} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm tabular-nums">
            <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
            {values.discountType !== "none" ? <SummaryRow label="Discount" value={`- ${formatCurrency(totals.discountAmount, currency)}`} /> : null}
            {business.gstEnabled ? (
              isInterState ? (
                <SummaryRow label="IGST" value={formatCurrency(totals.igstAmount, currency)} />
              ) : (
                <>
                  <SummaryRow label="CGST" value={formatCurrency(totals.cgstAmount, currency)} />
                  <SummaryRow label="SGST" value={formatCurrency(totals.sgstAmount, currency)} />
                </>
              )
            ) : (
              <SummaryRow label="Tax" value={formatCurrency(totals.taxAmount, currency)} />
            )}
            <div className="mt-2 flex items-center justify-between border-t pt-3 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(totals.total, currency)}</span>
            </div>
            {currency !== BASE_CURRENCY ? (
              <SummaryRow label={`Equivalent in ${BASE_CURRENCY}`} value={formatCurrency(totals.totalInr, BASE_CURRENCY)} muted />
            ) : null}
          </CardContent>
        </Card>

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

        <div className="flex flex-col gap-2">
          {mode === "create" || isDraftEdit ? (
            <>
              <Button type="button" onClick={() => submitWithStatus("pending")} disabled={isSubmitting || clients.length === 0}>
                {isSubmitting ? <Spinner /> : null} {mode === "create" ? "Issue invoice" : "Save & issue"}
              </Button>
              <Button type="button" variant="outline" onClick={() => submitWithStatus("draft")} disabled={isSubmitting || clients.length === 0}>
                {mode === "create" ? "Save as draft" : "Save draft"}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => submitWithStatus("pending")} disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null} Save changes
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => history.back()}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
