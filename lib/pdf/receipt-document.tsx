import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

import type { PaymentDetail } from "@/lib/data/payments";
import { BASE_CURRENCY } from "@/lib/currency";
import { formatCurrencyCode, formatDate, formatRate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/payment";

import { pdfStyles as s } from "./styles";

export function ReceiptDocument({ detail }: { detail: PaymentDetail }) {
  const { payment, invoice, client, business } = detail;
  const cur = invoice.currency;

  return (
    <Document title={payment.receiptNumber} author={business.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={{ maxWidth: 300 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
            {business.logoDataUrl ? <Image src={business.logoDataUrl} style={s.logo} /> : null}
            <Text style={s.businessName}>{business.name}</Text>
            {business.email ? <Text style={s.muted}>{business.email}</Text> : null}
            {business.phone ? <Text style={s.muted}>{business.phone}</Text> : null}
            {business.gstEnabled && business.gstin ? <Text style={{ marginTop: 3 }}>GSTIN: {business.gstin}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>PAYMENT RECEIPT</Text>
            <Text style={[s.right, s.bold, { fontSize: 11, marginTop: 4 }]}>{payment.receiptNumber}</Text>
          </View>
        </View>

        <View style={s.columns}>
          <View style={s.column}>
            <Text style={s.label}>Received from</Text>
            <Text style={s.bold}>{client.name}</Text>
            {client.email ? <Text style={s.muted}>{client.email}</Text> : null}
          </View>
          <View style={s.column}>
            <View style={s.metaGrid}>
              <View style={s.metaCell}>
                <Text style={s.label}>Payment date</Text>
                <Text>{formatDate(payment.paymentDate)}</Text>
              </View>
              <View style={s.metaCell}>
                <Text style={s.label}>Method</Text>
                <Text>{PAYMENT_METHOD_LABELS[payment.method]}</Text>
              </View>
              {payment.reference ? (
                <View style={s.metaCell}>
                  <Text style={s.label}>Reference</Text>
                  <Text>{payment.reference}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, { flex: 1 }]}>Against invoice</Text>
            <Text style={[s.th, { width: 90 }]}>Invoice date</Text>
            <Text style={[s.th, s.right, { width: 100 }]}>Invoice total</Text>
            <Text style={[s.th, s.right, { width: 100 }]}>Amount received</Text>
          </View>
          <View style={s.tableRowLast}>
            <Text style={[s.td, { flex: 1 }]}>{invoice.invoiceNumber}</Text>
            <Text style={[s.td, { width: 90 }]}>{formatDate(invoice.issueDate)}</Text>
            <Text style={[s.td, s.right, { width: 100 }]}>{formatCurrencyCode(invoice.total, cur)}</Text>
            <Text style={[s.td, s.right, { width: 100 }]}>{formatCurrencyCode(payment.amount, cur)}</Text>
          </View>
        </View>

        <View style={s.totals}>
          <View style={[s.totalRow, s.grandTotal]}>
            <Text>Amount received</Text>
            <Text>{formatCurrencyCode(payment.amount, cur)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.muted}>Remaining balance on invoice</Text>
            <Text>{formatCurrencyCode(invoice.balanceDue, cur)}</Text>
          </View>
          {cur !== BASE_CURRENCY ? (
            <View style={s.totalRow}>
              <Text style={s.muted}>
                Equivalent in {BASE_CURRENCY} (1 {cur} = {formatRate(invoice.exchangeRate)})
              </Text>
              <Text style={s.muted}>{formatCurrencyCode(payment.amountInr, BASE_CURRENCY)}</Text>
            </View>
          ) : null}
        </View>

        {payment.notes ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Notes</Text>
            <Text>{payment.notes}</Text>
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          {business.name} · {payment.receiptNumber} · Thank you for your payment.
        </Text>
      </Page>
    </Document>
  );
}
