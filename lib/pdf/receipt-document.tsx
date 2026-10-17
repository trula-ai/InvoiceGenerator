import { Document, Image, Link, Page, Text, View } from "@react-pdf/renderer";

import type { ReceiptRenderData } from "@/lib/data/receipts";
import { formatCurrencyCode, formatDate } from "@/lib/format";
import { isZero } from "@/lib/money";

import { pdfStyles as s } from "./styles";

/**
 * Client-facing payment receipt, rendered entirely from the frozen snapshot
 * in `receipts`. It shows paid now, total paid so far and balance outstanding
 * as three distinct figures, says "paid in full" only when the balance is
 * zero, and carries the terms in force when it was issued. Nothing internal
 * (salesperson, verification notes, bank account details) is printed.
 */
export function ReceiptDocument({ data }: { data: ReceiptRenderData }) {
  const { receipt, business, client } = data;
  const cur = receipt.currency;
  const settled = isZero(receipt.balanceDue);
  const addressParts = [business.addressLine1, business.addressLine2, [business.city, business.state, business.postalCode].filter(Boolean).join(", "), business.country].filter(Boolean);

  return (
    <Document title={receipt.receiptNumber} author={business.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={{ maxWidth: 300 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
            {business.logoDataUrl ? <Image src={business.logoDataUrl} style={s.logo} /> : null}
            <Text style={s.businessName}>{business.legalName || business.name}</Text>
            {addressParts.map((line, i) => (
              <Text key={i} style={s.muted}>
                {line}
              </Text>
            ))}
            {business.email ? <Text style={s.muted}>{business.email}</Text> : null}
            {business.phone ? <Text style={s.muted}>{business.phone}</Text> : null}
            {business.gstEnabled && business.gstin ? <Text style={{ marginTop: 3 }}>GSTIN: {business.gstin}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>PAYMENT RECEIPT</Text>
            <Text style={[s.right, s.bold, { fontSize: 11, marginTop: 4 }]}>{receipt.receiptNumber}</Text>
            <Text style={[s.right, s.muted, { marginTop: 2 }]}>Issued {formatDate(receipt.issuedAt)}</Text>
            {receipt.voidedAt ? <Text style={[s.right, s.bold, { marginTop: 4, color: "#b91c1c" }]}>VOID · payment reversed {formatDate(receipt.voidedAt)}</Text> : null}
          </View>
        </View>

        <View style={s.columns}>
          <View style={s.column}>
            <Text style={s.label}>Received from</Text>
            <Text style={s.bold}>{client.name}</Text>
            {client.contactName ? <Text style={s.muted}>{client.contactName}</Text> : null}
            {client.email ? <Text style={s.muted}>{client.email}</Text> : null}
          </View>
          <View style={s.column}>
            <View style={s.metaGrid}>
              <View style={s.metaCell}>
                <Text style={s.label}>Against invoice</Text>
                <Text>{receipt.invoiceNumber}</Text>
                <Text style={s.muted}>dated {formatDate(receipt.invoiceDate)}</Text>
              </View>
              <View style={s.metaCell}>
                <Text style={s.label}>Payment received on</Text>
                <Text>{formatDate(receipt.paymentDate)}</Text>
              </View>
              <View style={s.metaCell}>
                <Text style={s.label}>Mode</Text>
                <Text>{receipt.methodLabel}</Text>
              </View>
              {receipt.reference ? (
                <View style={s.metaCell}>
                  <Text style={s.label}>Transaction reference</Text>
                  <Text>{receipt.reference}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {receipt.serviceDescription ? (
          <View style={s.block}>
            <Text style={s.label}>Service</Text>
            <Text>{receipt.serviceDescription}</Text>
          </View>
        ) : null}

        <View style={s.totals}>
          <View style={[s.totalRow, s.grandTotal]}>
            <Text>Paid now</Text>
            <Text>{formatCurrencyCode(receipt.amount, cur)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.muted}>Invoice amount</Text>
            <Text>{formatCurrencyCode(receipt.invoiceTotal, cur)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.muted}>Total paid so far</Text>
            <Text>{formatCurrencyCode(receipt.cumulativePaid, cur)}</Text>
          </View>
          <View style={[s.totalRow, settled ? {} : s.bold]}>
            <Text>Balance outstanding</Text>
            <Text>{formatCurrencyCode(receipt.balanceDue, cur)}</Text>
          </View>
        </View>

        <View style={[s.block, { marginTop: 8 }]}>
          <Text style={s.label}>Payment status</Text>
          <Text style={s.bold}>{settled ? "PAID IN FULL" : "PARTIALLY PAID"}</Text>
          {!settled ? (
            <Text style={receipt.wasOverdue ? { color: "#b91c1c" } : undefined}>
              {formatCurrencyCode(receipt.balanceDue, cur)} remains outstanding{receipt.wasOverdue ? ` and was due on ${formatDate(receipt.dueDate)}.` : `, due by ${formatDate(receipt.dueDate)}.`}
            </Text>
          ) : null}
        </View>

        {receipt.termsText || receipt.privacyUrl ? (
          <View style={s.wordsBox}>
            <Text style={s.label}>Payment terms</Text>
            {receipt.termsText ? <Text style={{ fontSize: 8.5, lineHeight: 1.4 }}>{receipt.termsText}</Text> : null}
            {receipt.privacyUrl ? (
              <Text style={{ fontSize: 8.5, marginTop: 4 }}>
                Privacy policy: <Link src={receipt.privacyUrl}>{receipt.privacyUrl}</Link>
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          {business.name} · Receipt {receipt.receiptNumber} · Receipt ID {receipt.id} · This receipt acknowledges the payment above and is not a tax invoice.
        </Text>
      </Page>
    </Document>
  );
}
