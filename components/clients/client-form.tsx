"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CLIENT_TYPE_OPTIONS, CURRENCY_OPTIONS, INDIA_STATE_OPTIONS } from "@/components/shared/options";
import { SelectField } from "@/components/shared/select-field";
import { createClientAction, updateClientAction } from "@/lib/actions/clients";
import { clientSchema, type ClientInput, type ClientValues } from "@/lib/validation/client";

interface ClientFormProps {
  mode: "create" | "edit";
  clientId?: string;
  defaultValues?: Partial<ClientInput>;
  defaultCurrency: string;
}

export function ClientForm({ mode, clientId, defaultValues, defaultCurrency }: ClientFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ClientInput, unknown, ClientValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      type: "b2b",
      name: "",
      contactName: "",
      email: "",
      phone: "",
      gstin: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      stateCode: "",
      postalCode: "",
      country: "India",
      shippingAddress: "",
      currency: defaultCurrency,
      notes: "",
      autoReminders: true,
      ...defaultValues,
    },
  });

  const { errors, isSubmitting } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });
  const country = useWatch({ control: form.control, name: "country" });
  const isIndia = (country ?? "").trim().toLowerCase() === "india";

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = mode === "create" ? await createClientAction(values) : await updateClientAction(clientId!, values);
    if (result && !result.ok) {
      setServerError(result.error);
      toast.error(result.error);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Client details</CardTitle>
            <CardDescription>Who you are invoicing and how to reach them.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={!!errors.type}>
                  <FieldLabel htmlFor="type">Client type</FieldLabel>
                  <Controller
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <SelectField id="type" options={CLIENT_TYPE_OPTIONS} value={field.value ?? "b2b"} onValueChange={field.onChange} />
                    )}
                  />
                  <FieldDescription>Sets the default invoice type for this client.</FieldDescription>
                </Field>
                <Field data-invalid={!!errors.currency}>
                  <FieldLabel htmlFor="currency">Invoicing currency</FieldLabel>
                  <Controller
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <SelectField id="currency" options={CURRENCY_OPTIONS} value={field.value ?? defaultCurrency} onValueChange={field.onChange} invalid={!!errors.currency} />
                    )}
                  />
                  <FieldError errors={[errors.currency]} />
                </Field>
              </div>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">{type === "b2c" ? "Full name" : "Company name"}</FieldLabel>
                <Input id="name" {...form.register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                {type === "b2b" ? (
                  <Field data-invalid={!!errors.contactName}>
                    <FieldLabel htmlFor="contactName">Contact person</FieldLabel>
                    <Input id="contactName" {...form.register("contactName")} />
                    <FieldError errors={[errors.contactName]} />
                  </Field>
                ) : null}
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" type="email" placeholder="billing@client.com" {...form.register("email")} />
                  <FieldDescription>Invoices are emailed to this address.</FieldDescription>
                  <FieldError errors={[errors.email]} />
                </Field>
                <Field data-invalid={!!errors.phone}>
                  <FieldLabel htmlFor="phone">Phone</FieldLabel>
                  <Input id="phone" {...form.register("phone")} />
                  <FieldError errors={[errors.phone]} />
                </Field>
                {type === "b2b" ? (
                  <Field data-invalid={!!errors.gstin}>
                    <FieldLabel htmlFor="gstin">GSTIN</FieldLabel>
                    <Input id="gstin" placeholder="22AAAAA0000A1Z5" className="uppercase" {...form.register("gstin")} />
                    <FieldDescription>Required for GST B2B invoices.</FieldDescription>
                    <FieldError errors={[errors.gstin]} />
                  </Field>
                ) : null}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing address</CardTitle>
            <CardDescription>Printed on invoices and used to determine the place of supply.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.addressLine1}>
                <FieldLabel htmlFor="addressLine1">Address line 1</FieldLabel>
                <Input id="addressLine1" {...form.register("addressLine1")} />
              </Field>
              <Field data-invalid={!!errors.addressLine2}>
                <FieldLabel htmlFor="addressLine2">Address line 2</FieldLabel>
                <Input id="addressLine2" {...form.register("addressLine2")} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={!!errors.city}>
                  <FieldLabel htmlFor="city">City</FieldLabel>
                  <Input id="city" {...form.register("city")} />
                </Field>
                <Field data-invalid={!!errors.postalCode}>
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
                    <FieldDescription>Determines CGST/SGST vs IGST.</FieldDescription>
                    <FieldError errors={[errors.stateCode]} />
                  </Field>
                ) : (
                  <Field data-invalid={!!errors.state}>
                    <FieldLabel htmlFor="state">State / region</FieldLabel>
                    <Input id="state" {...form.register("state")} />
                  </Field>
                )}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipping address</CardTitle>
            <CardDescription>Only if goods are delivered somewhere other than the billing address. Prefills &ldquo;Ship to&rdquo; on new invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field data-invalid={!!errors.shippingAddress}>
              <Textarea id="shippingAddress" rows={4} placeholder={"Warehouse name\nStreet\nCity, State, PIN"} {...form.register("shippingAddress")} />
              <FieldError errors={[errors.shippingAddress]} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Internal notes, not shown to the client.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea rows={6} {...form.register("notes")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment reminders</CardTitle>
            <CardDescription>Scheduled reminder emails for unpaid invoices. You can always send one manually.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="autoReminders"
                render={({ field }) => <Switch id="autoReminders" checked={field.value ?? true} onCheckedChange={(checked) => field.onChange(checked)} />}
              />
              <FieldLabel htmlFor="autoReminders">Automatic reminders</FieldLabel>
            </Field>
          </CardContent>
        </Card>

        {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? <Spinner /> : null} {mode === "create" ? "Create client" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => history.back()}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
