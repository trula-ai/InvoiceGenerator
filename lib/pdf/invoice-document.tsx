import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

import type { InvoiceDetail } from "@/lib/data/invoices";
import { formatAmount, formatCurrencyCode, formatDate, formatRate, INVOICE_STATUS_LABELS } from "@/lib/format";
import { BASE_CURRENCY } from "@/lib/currency";
import { isZero } from "@/lib/money";

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

export function InvoiceDocument({ detail }: { detail: InvoiceDetail }) {
  const { invoice, client, business, items } = detail;
  const cur = invoice.currency;
  const showGst = invoice.gstApplied;
  const showDiscount = !isZero(invoice.discountAmount);
  const title = invoice.invoiceType === "b2b" && showGst ? "TAX INVOICE" : "INVOICE";

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

        {/* Parties + meta */}
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
            {showGst && invoice.clientGstin ? <Text style={{ marginTop: 3 }}>GSTIN: {invoice.clientGstin}</Text> : null}
          </View>
          <View style={s.column}>
            <View style={s.metaGrid}>
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
            </View>
          </View>
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

        {/* Notes, terms, bank details */}
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

        <Text style={s.footer} fixed>
          {business.name} · {invoice.invoiceNumber} · This is a computer-generated document.
        </Text>
      </Page>
    </Document>
  );
}
