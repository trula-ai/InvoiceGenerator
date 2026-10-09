"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createItemAction, updateItemAction } from "@/lib/actions/items";
import { itemSchema, type ItemInput, type ItemValues } from "@/lib/validation/item";

interface ItemFormProps {
  mode: "create" | "edit";
  itemId?: string;
  defaultValues?: Partial<ItemInput>;
  gstEnabled: boolean;
  currency: string;
}

export function ItemForm({ mode, itemId, defaultValues, gstEnabled, currency }: ItemFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ItemInput, unknown, ItemValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: "",
      description: "",
      hsnSac: "",
      unit: "",
      unitPrice: "",
      taxRate: gstEnabled ? "18" : "0",
      ...defaultValues,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = mode === "create" ? await createItemAction(values) : await updateItemAction(itemId!, values);
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
            <CardTitle>Item details</CardTitle>
            <CardDescription>Picking this item in the invoice form fills the line with these values. You can still edit them per invoice.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" placeholder="Web design services" {...form.register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.description}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea id="description" rows={3} placeholder="Printed under the name on the invoice line" {...form.register("description")} />
                <FieldError errors={[errors.description]} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={!!errors.hsnSac}>
                  <FieldLabel htmlFor="hsnSac">{gstEnabled ? "HSN / SAC code" : "Item code"}</FieldLabel>
                  <Input id="hsnSac" placeholder={gstEnabled ? "998314" : ""} {...form.register("hsnSac")} />
                  {gstEnabled ? <FieldDescription>HSN for goods, SAC for services. Required on B2B tax invoices.</FieldDescription> : null}
                  <FieldError errors={[errors.hsnSac]} />
                </Field>
                <Field data-invalid={!!errors.unit}>
                  <FieldLabel htmlFor="unit">Unit</FieldLabel>
                  <Input id="unit" placeholder="hrs, pcs, kg" {...form.register("unit")} />
                  <FieldError errors={[errors.unit]} />
                </Field>
                <Field data-invalid={!!errors.unitPrice}>
                  <FieldLabel htmlFor="unitPrice">Unit price ({currency})</FieldLabel>
                  <Input id="unitPrice" inputMode="decimal" placeholder="0.00" {...form.register("unitPrice")} />
                  <FieldError errors={[errors.unitPrice]} />
                </Field>
                <Field data-invalid={!!errors.taxRate}>
                  <FieldLabel htmlFor="taxRate">Tax rate (%)</FieldLabel>
                  <Input id="taxRate" inputMode="decimal" placeholder="18" {...form.register("taxRate")} />
                  <FieldError errors={[errors.taxRate]} />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Save</CardTitle>
            <CardDescription>Changes apply to new invoice lines only. Existing invoices keep their own copy.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null} {mode === "create" ? "Create item" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => history.back()}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
