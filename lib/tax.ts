/**
 * GST supply classification. Pure module shared by the invoice form (live
 * totals and warnings) and the server (validation, stored snapshot).
 *
 * The classification is an explicit choice on every GST invoice, never a
 * guess from the address: a foreign client defaults to "international,
 * taxable" and only a deliberate selection, backed by the business's LUT
 * where required, makes an invoice an export. See requirements section 11.
 */

export const SUPPLY_TYPES = ["domestic_intra_state", "domestic_inter_state", "export_lut", "export_with_igst", "international_taxable", "exempt"] as const;
export type SupplyType = (typeof SUPPLY_TYPES)[number];

/** How tax is computed for a supply type. */
export type TaxTreatment = "cgst_sgst" | "igst" | "zero_rated" | "exempt";

export const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  domestic_intra_state: "Domestic, intra-state (CGST + SGST)",
  domestic_inter_state: "Domestic, inter-state (IGST)",
  export_lut: "Export of services under LUT (zero-rated, no IGST)",
  export_with_igst: "Export of services with IGST paid",
  international_taxable: "International client, taxable (IGST)",
  exempt: "Exempt or nil-rated supply",
};

export const SUPPLY_TYPE_SHORT: Record<SupplyType, string> = {
  domestic_intra_state: "Intra-state · CGST + SGST",
  domestic_inter_state: "Inter-state · IGST",
  export_lut: "Export under LUT · zero-rated",
  export_with_igst: "Export with IGST",
  international_taxable: "International · IGST",
  exempt: "Exempt",
};

export const SUPPLY_TYPE_HELP: Record<SupplyType, string> = {
  domestic_intra_state: "Client in your own state. Tax is split into CGST and SGST.",
  domestic_inter_state: "Client in another Indian state. Tax is charged as IGST.",
  export_lut: "Zero-rated export without payment of IGST. Only for services that qualify as exports, and only while your Letter of Undertaking is valid.",
  export_with_igst: "Export of services on which IGST is paid and later claimed. Only for services that qualify as exports.",
  international_taxable: "Client outside India, but the service does not (or has not been confirmed to) qualify as an export. IGST is charged. This is the safe default.",
  exempt: "A supply that is exempt or nil-rated under GST. Not the same as a zero-rated export.",
};

/** GST state code used for a place of supply outside India. */
export const FOREIGN_PLACE_OF_SUPPLY_CODE = "96";

export function isIndia(country: string | null | undefined): boolean {
  return (country ?? "").trim().toLowerCase() === "india";
}

export function taxTreatmentFor(supplyType: SupplyType): TaxTreatment {
  switch (supplyType) {
    case "domestic_intra_state":
      return "cgst_sgst";
    case "domestic_inter_state":
    case "export_with_igst":
    case "international_taxable":
      return "igst";
    case "export_lut":
      return "zero_rated";
    case "exempt":
      return "exempt";
  }
}

export function isForeignSupply(supplyType: SupplyType): boolean {
  return supplyType === "export_lut" || supplyType === "export_with_igst" || supplyType === "international_taxable";
}

export interface SupplyContext {
  clientCountry: string | null | undefined;
  /** Client's GST state code, when in India. */
  clientStateCode: string | null | undefined;
  /** Business's GST state code. */
  businessStateCode: string | null | undefined;
  /** Place of supply chosen on the invoice, when any. */
  placeOfSupplyCode?: string | null;
}

/**
 * Default classification for a client. Domestic clients are intra- or
 * inter-state from the place of supply; a foreign client is "international,
 * taxable" until someone deliberately marks the invoice as an export.
 */
export function suggestSupplyType(ctx: SupplyContext): SupplyType {
  if (!isIndia(ctx.clientCountry)) return "international_taxable";
  const place = ctx.placeOfSupplyCode || ctx.clientStateCode || ctx.businessStateCode || null;
  if (place && ctx.businessStateCode && place !== ctx.businessStateCode) return "domestic_inter_state";
  return "domestic_intra_state";
}

export interface LutDetails {
  lutNumber: string | null | undefined;
  /** ISO date; the LUT must cover the invoice's issue date. */
  lutValidUntil: string | null | undefined;
}

export function lutCovers(lut: LutDetails, issueDate: string): boolean {
  return !!lut.lutNumber?.trim() && !!lut.lutValidUntil && lut.lutValidUntil >= issueDate;
}

/**
 * Why a supply type may not be used for this invoice, or null when it is
 * allowed. The same rules run in the form (to explain) and on the server
 * (to refuse).
 */
export function supplyTypeProblem(supplyType: SupplyType, ctx: SupplyContext, lut: LutDetails, issueDate: string): string | null {
  const foreign = !isIndia(ctx.clientCountry);
  switch (supplyType) {
    case "domestic_intra_state":
    case "domestic_inter_state": {
      if (foreign) return "A domestic classification needs a client in India. Choose an international classification instead.";
      const place = ctx.placeOfSupplyCode || ctx.clientStateCode || ctx.businessStateCode || null;
      if (!place) return "Select the place of supply first.";
      if (!ctx.businessStateCode) return "Set your business state in Settings before issuing GST invoices.";
      const inter = place !== ctx.businessStateCode;
      if (supplyType === "domestic_intra_state" && inter) return "The place of supply is in another state, so this is an inter-state supply (IGST).";
      if (supplyType === "domestic_inter_state" && !inter) return "The place of supply is in your own state, so this is an intra-state supply (CGST + SGST).";
      return null;
    }
    case "export_lut":
      if (!foreign) return "Exports need a client outside India.";
      if (!lut.lutNumber?.trim()) return "Add your Letter of Undertaking (LUT) number in Settings before issuing zero-rated exports.";
      if (!lutCovers(lut, issueDate)) return `Your LUT is valid until ${lut.lutValidUntil ?? "an unknown date"}, which does not cover the issue date ${issueDate}.`;
      return null;
    case "export_with_igst":
    case "international_taxable":
      if (!foreign) return "An international classification needs a client outside India.";
      return null;
    case "exempt":
      return null;
  }
}

/** Statutory endorsement printed on the document for the classification (CGST Rule 46). */
export function supplyDeclaration(supplyType: SupplyType | null | undefined, lutReference?: string | null): string | null {
  switch (supplyType) {
    case "export_lut":
      return `Supply meant for export under bond or Letter of Undertaking without payment of integrated tax${lutReference ? ` (LUT ${lutReference})` : ""}.`;
    case "export_with_igst":
      return "Supply meant for export on payment of integrated tax.";
    case "international_taxable":
      return "Supply to a recipient outside India, not classified as an export of services. Integrated tax charged.";
    case "exempt":
      return "Exempt or nil-rated supply. No tax charged.";
    default:
      return null;
  }
}
