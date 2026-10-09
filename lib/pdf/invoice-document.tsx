import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

import { amountInWords } from "@/lib/amount-in-words";
import type { InvoiceDetail } from "@/lib/data/invoices";
import { formatAmount, formatCurrencyCode, formatDate, formatRate, INVOICE_STATUS_LABELS } from "@/lib/format";
import { BASE_CURRENCY } from "@/lib/currency";
import { summariseByHsn } from "@/lib/hsn-summary";
import { D, isZero } from "@/lib/money";

import { pdfStyles as s } from "./styles";

function addressLines(a: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string[] {
  const cityLine = [a.city, a.state, a.postalCode].filter(Boolean).join(", ");
  return [a.addressLine1, a.addressLine2, cityLine, a.country].filter((l): l is string => !!l && l.trim() !== "");
}

/** Splits a multi-line free-text address into trimmed, non-empty lines. */
function textLines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function InvoiceDocument({ detail }: { detail: InvoiceDetail }) {
  const { invoice, client, business, items } = detail;
  const cur = invoice.currency;
  const showGst = invoice.gstApplied;
  const showDiscount = !isZero(invoice.discountAmount);
  const showRoundOff = !isZero(invoice.roundOffAmount);
  const roundOffPositive = D(invoice.roundOffAmount).greaterThan(0);
  const title = invoice.invoiceType === "b2b" && showGst ? "TAX INVOICE" : "INVOICE";
  const shipTo = textLines(invoice.shipToAddress);
  const hsnRows = showGst ? summariseByHsn(items, invoice.isInterState) : [];
  const showSignatory = showGst || !!business.signatureDataUrl || !!business.signatoryName;

  return (
    <Document title={`${invoice.invoiceNumber}`} author={business.name}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ maxWidth: 300 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
            {business.logoDataUrl ? <Image src={business.logoDataUrl} style={s.logo} /> : null}
            <Text style={s.businessName}>{business.name}</Text>
            {addressLines(business).map((line, i) => (
              <Text key={i} style={s.muted}>
                {line}
              </Text>
            ))}
            {business.email ? <Text style={s.muted}>{business.email}</Text> : null}
            {business.phone ? <Text style={s.muted}>{business.phone}</Text> : null}
            {showGst && business.gstin ? <Text style={{ marginTop: 3 }}>GSTIN: {business.gstin}</Text> : null}
            {business.pan ? <Text>PAN: {business.pan}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>{title}</Text>
            <Text style={[s.right, s.bold, { fontSize: 11, marginTop: 4 }]}>{invoice.invoiceNumber}</Text>
            <Text style={s.badge}>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</Text>
          </View>
        </View>

        {/* Meta strip */}
        <View style={s.metaStrip}>
          <View style={s.metaCell}>
            <Text style={s.label}>Issue date</Text>
            <Text>{formatDate(invoice.issueDate)}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.label}>Due date</Text>
            <Text>{formatDate(invoice.dueDate)}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.label}>Invoice type</Text>
            <Text>{invoice.invoiceType.toUpperCase()}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.label}>Currency</Text>
            <Text>{cur}</Text>
          </View>
          {showGst && invoice.placeOfSupply ? (
            <View style={s.metaCell}>
              <Text style={s.label}>Place of supply</Text>
              <Text>
                {invoice.placeOfSupply} ({invoice.placeOfSupplyCode})
              </Text>
            </View>
          ) : null}
          {cur !== BASE_CURRENCY ? (
            <View style={s.metaCell}>
              <Text style={s.label}>Exchange rate</Text>
              <Text>
                1 {cur} = {formatRate(invoice.exchangeRate)} {BASE_CURRENCY}
              </Text>
            </View>
          ) : null}
          {invoice.poNumber ? (
            <View style={s.metaCell}>
              <Text style={s.label}>PO number</Text>
              <Text>{invoice.poNumber}</Text>
            </View>
          ) : null}
          {invoice.reference ? (
            <View style={s.metaCell}>
              <Text style={s.label}>Reference</Text>
              <Text>{invoice.reference}</Text>
            </View>
          ) : null}
        </View>

        {/* Parties */}
        <View style={s.columns}>
          <View style={s.column}>
            <Text style={s.label}>Bill to</Text>
            <Text style={s.bold}>{client.name}</Text>
            {client.contactName ? <Text>{client.contactName}</Text> : null}
            {addressLines(client).map((line, i) => (
              <Text key={i} style={s.muted}>
                {line}
              </Text>
            ))}
            {client.email ? <Text style={s.muted}>{client.email}</Text> : null}
            {client.phone ? <Text style={s.muted}>{client.phone}</Text> : null}
            {showGst && invoice.clientGstin ? <Text style={{ marginTop: 3 }}>GSTIN: {invoice.clientGstin}</Text> : null}
          </View>
          {shipTo.length ? (
            <View style={s.column}>
              <Text style={s.label}>Ship to</Text>
              {shipTo.map((line, i) => (
                <Text key={i} style={i === 0 ? s.bold : s.muted}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Items */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, { width: 24 }]}>#</Text>
            <Text style={[s.th, { flex: 1 }]}>Description</Text>
            {showGst ? <Text style={[s.th, { width: 56 }]}>HSN/SAC</Text> : null}
            <Text style={[s.th, s.right, { width: 50 }]}>Qty</Text>
            <Text style={[s.th, s.right, { width: 70 }]}>Rate</Text>
            <Text style={[s.th, s.right, { width: 44 }]}>Tax %</Text>
            <Text style={[s.th, s.right, { width: 80 }]}>Amount</Text>
          </View>
          {items.map((item, i) => (
            <View key={item.id} style={i === items.length - 1 ? s.tableRowLast : s.tableRow} wrap={false}>
              <Text style={[s.td, { width: 24 }]}>{i + 1}</Text>
              <View style={[s.td, { flex: 1 }]}>
                <Text>{item.description}</Text>
              </View>
              {showGst ? <Text style={[s.td, { width: 56 }]}>{item.hsnSac ?? ""}</Text> : null}
              <Text style={[s.td, s.right, { width: 50 }]}>
                {Number(item.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                {item.unit ? ` ${item.unit}` : ""}
              </Text>
              <Text style={[s.td, s.right, { width: 70 }]}>{formatAmount(item.unitPrice, cur)}</Text>
              <Text style={[s.td, s.right, { width: 44 }]}>{Number(item.taxRate).toFixed(2)}</Text>
              <Text style={[s.td, s.right, { width: 80 }]}>{formatAmount(item.lineSubtotal, cur)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.muted}>Subtotal</Text>
            <Text>{formatCurrencyCode(invoice.subtotal, cur)}</Text>
          </View>
          {showDiscount ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>
                Discount{invoice.discountType === "percent" ? ` (${Number(invoice.discountValue).toFixed(2)}%)` : ""}
              </Text>
              <Text>- {formatCurrencyCode(invoice.discountAmount, cur)}</Text>
            </View>
          ) : null}
          {showDiscount ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>Taxable amount</Text>
              <Text>{formatCurrencyCode(invoice.taxableAmount, cur)}</Text>
            </View>
          ) : null}
          {showGst ? (
            invoice.isInterState ? (
              <View style={s.totalRow}>
                <Text style={s.muted}>IGST</Text>
                <Text>{formatCurrencyCode(invoice.igstAmount, cur)}</Text>
              </View>
            ) : (
              <>
                <View style={s.totalRow}>
                  <Text style={s.muted}>CGST</Text>
                  <Text>{formatCurrencyCode(invoice.cgstAmount, cur)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.muted}>SGST</Text>
                  <Text>{formatCurrencyCode(invoice.sgstAmount, cur)}</Text>
                </View>
              </>
            )
          ) : !isZero(invoice.taxAmount) ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>Tax</Text>
              <Text>{formatCurrencyCode(invoice.taxAmount, cur)}</Text>
            </View>
          ) : null}
          {showRoundOff ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>Round off</Text>
              <Text>
                {roundOffPositive ? "+ " : "- "}
                {formatCurrencyCode(D(invoice.roundOffAmount).abs().toFixed(2), cur)}
              </Text>
            </View>
          ) : null}
          <View style={[s.totalRow, s.grandTotal]}>
            <Text>Total</Text>
            <Text>{formatCurrencyCode(invoice.total, cur)}</Text>
          </View>
          {!isZero(invoice.amountPaid) ? (
            <>
              <View style={s.totalRow}>
                <Text style={s.muted}>Amount paid</Text>
                <Text>- {formatCurrencyCode(invoice.amountPaid, cur)}</Text>
              </View>
              <View style={[s.totalRow, s.bold]}>
                <Text>Balance due</Text>
                <Text>{formatCurrencyCode(invoice.balanceDue, cur)}</Text>
              </View>
            </>
          ) : null}
          {cur !== BASE_CURRENCY ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>Equivalent in {BASE_CURRENCY}</Text>
              <Text style={s.muted}>{formatCurrencyCode(invoice.totalInr, BASE_CURRENCY)}</Text>
            </View>
          ) : null}
        </View>

        {/* Amount in words */}
        <View style={s.wordsBox} wrap={false}>
          <Text style={s.label}>Amount in words</Text>
          <Text style={s.bold}>{amountInWords(invoice.total, cur)}</Text>
        </View>

        {/* HSN / SAC summary */}
        {hsnRows.length ? (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>HSN / SAC summary</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.th, { width: 80 }]}>HSN/SAC</Text>
                <Text style={[s.th, s.right, { flex: 1 }]}>Taxable value</Text>
                <Text style={[s.th, s.right, { width: 50 }]}>Rate %</Text>
                {invoice.isInterState ? (
                  <Text style={[s.th, s.right, { width: 90 }]}>IGST</Text>
                ) : (
                  <>
                    <Text style={[s.th, s.right, { width: 90 }]}>CGST</Text>
                    <Text style={[s.th, s.right, { width: 90 }]}>SGST</Text>
                  </>
                )}
                <Text style={[s.th, s.right, { width: 90 }]}>Total tax</Text>
              </View>
              {hsnRows.map((row, i) => (
                <View key={`${row.hsnSac}-${row.taxRate}`} style={i === hsnRows.length - 1 ? s.tableRowLast : s.tableRow}>
                  <Text style={[s.td, { width: 80 }]}>{row.hsnSac}</Text>
                  <Text style={[s.td, s.right, { flex: 1 }]}>{formatAmount(row.taxableAmount, cur)}</Text>
                  <Text style={[s.td, s.right, { width: 50 }]}>{Number(row.taxRate).toFixed(2)}</Text>
                  {invoice.isInterState ? (
                    <Text style={[s.td, s.right, { width: 90 }]}>{formatAmount(row.igstAmount, cur)}</Text>
                  ) : (
                    <>
                      <Text style={[s.td, s.right, { width: 90 }]}>{formatAmount(row.cgstAmount, cur)}</Text>
                      <Text style={[s.td, s.right, { width: 90 }]}>{formatAmount(row.sgstAmount, cur)}</Text>
                    </>
                  )}
                  <Text style={[s.td, s.right, { width: 90 }]}>{formatAmount(row.taxAmount, cur)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Footer row: payment details, notes and terms on the left; authorised signatory on the right */}
        <View style={s.footerRow}>
          <View style={s.footerMain}>
            {business.bankDetails ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Payment details</Text>
                <Text>{business.bankDetails}</Text>
              </View>
            ) : null}
            {invoice.notes ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Notes</Text>
                <Text>{invoice.notes}</Text>
              </View>
            ) : null}
            {invoice.terms ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Terms</Text>
                <Text>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
          {showSignatory ? (
            <View style={s.signatory} wrap={false}>
              <Text style={s.bold}>For {business.legalName || business.name}</Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
              {business.signatureDataUrl ? <Image src={business.signatureDataUrl} style={s.signature} /> : <View style={s.signatureSpace} />}
              <View style={s.signatureLine} />
              {business.signatoryName ? <Text>{business.signatoryName}</Text> : null}
              <Text style={s.muted}>Authorised Signatory</Text>
            </View>
          ) : null}
        </View>

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${business.name} · ${invoice.invoiceNumber} · Page ${pageNumber} of ${totalPages} · This is a computer-generated document.`
          }
        />
      </Page>
    </Document>
  );
}
