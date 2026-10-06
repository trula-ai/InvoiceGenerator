import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

import { emailStyles as styles } from "./styles";

export interface StatementInvoiceRow {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalFormatted: string;
  balanceFormatted: string;
  /** e.g. "Due in 3 days", "Due today", "12 days overdue". */
  statusLabel: string;
  overdue: boolean;
  viewUrl?: string;
}

export interface StatementEmailProps {
  businessName: string;
  clientName: string;
  invoices: StatementInvoiceRow[];
  /** One formatted total per currency, e.g. ["₹29,500.00", "$1,359.98"]. */
  totals: string[];
  message?: string;
  bankDetails?: string | null;
}

export function statementSubject(props: Pick<StatementEmailProps, "businessName" | "invoices">): string {
  const n = props.invoices.length;
  const overdue = props.invoices.filter((i) => i.overdue).length;
  const base = `Payment statement from ${props.businessName}: ${n} invoice${n === 1 ? "" : "s"} outstanding`;
  return overdue ? `${base} (${overdue} overdue)` : base;
}

function intro(props: StatementEmailProps): string {
  return `Here is a summary of the invoices currently outstanding on your account with ${props.businessName}. The total due is ${props.totals.join(" + ")}.`;
}

const cell = { padding: "8px 6px", fontSize: 13, color: "#3f3f46", borderBottom: "1px solid #e4e4e7", verticalAlign: "top" as const };
const head = { ...cell, color: "#71717a", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: 0.5, borderBottom: "2px solid #e4e4e7" };
const right = { textAlign: "right" as const };

export function StatementEmail(props: StatementEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{intro(props)}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Payment statement</Heading>
          <Text style={styles.text}>Hi {props.clientName},</Text>
          <Text style={styles.text}>{props.message?.trim() || intro(props)}</Text>

          <Section>
            <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left" style={head}>
                    Invoice
                  </th>
                  <th align="left" style={head}>
                    Due
                  </th>
                  <th align="right" style={{ ...head, ...right }}>
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {props.invoices.map((inv) => (
                  <tr key={inv.invoiceNumber}>
                    <td style={cell}>
                      <strong>{inv.viewUrl ? <Link href={inv.viewUrl}>{inv.invoiceNumber}</Link> : inv.invoiceNumber}</strong>
                      <br />
                      <span style={{ color: "#71717a", fontSize: 12 }}>Issued {inv.issueDate}</span>
                    </td>
                    <td style={cell}>
                      {inv.dueDate}
                      <br />
                      <span style={{ color: inv.overdue ? "#dc2626" : "#71717a", fontSize: 12 }}>{inv.statusLabel}</span>
                    </td>
                    <td style={{ ...cell, ...right }}>
                      <strong>{inv.balanceFormatted}</strong>
                      <br />
                      <span style={{ color: "#71717a", fontSize: 12 }}>of {inv.totalFormatted}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section style={{ marginTop: 16 }}>
            <Text style={styles.label}>Total due</Text>
            <Text style={styles.value}>{props.totals.join(" + ")}</Text>
          </Section>

          <Text style={styles.text}>If you have already paid any of these, please ignore that line. The invoice PDFs are attached for your reference.</Text>

          {props.bankDetails ? (
            <>
              <Hr style={styles.hr} />
              <Text style={styles.label}>Payment details</Text>
              <Text style={styles.pre}>{props.bankDetails}</Text>
            </>
          ) : null}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>Sent by {props.businessName}. Reply to this email if you have any questions.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function statementEmailText(props: StatementEmailProps): string {
  return [
    statementSubject(props),
    "",
    `Hi ${props.clientName},`,
    props.message?.trim() || intro(props),
    "",
    ...props.invoices.map(
      (inv) => `${inv.invoiceNumber} · issued ${inv.issueDate} · due ${inv.dueDate} (${inv.statusLabel}) · balance ${inv.balanceFormatted} of ${inv.totalFormatted}${inv.viewUrl ? ` · ${inv.viewUrl}` : ""}`,
    ),
    "",
    `Total due: ${props.totals.join(" + ")}`,
    "If you have already paid any of these, please ignore that line.",
    props.bankDetails ? `\nPayment details:\n${props.bankDetails}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
