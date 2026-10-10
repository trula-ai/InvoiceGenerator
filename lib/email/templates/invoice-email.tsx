import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { DocumentKind } from "@/db/schema";
import { documentLabel } from "@/lib/documents";

export interface InvoiceEmailProps {
  kind: DocumentKind;
  businessName: string;
  clientName: string;
  invoiceNumber: string;
  issueDate: string;
  /** Due date for invoices, validity date for quotes, credit date for credit notes. */
  dueDate: string;
  totalFormatted: string;
  balanceFormatted: string;
  /** Invoice number a credit note is issued against. */
  sourceNumber?: string | null;
  viewUrl?: string;
  message?: string;
  bankDetails?: string | null;
}

const styles = {
  body: { backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" },
  container: { backgroundColor: "#ffffff", borderRadius: 14, margin: "0 auto", maxWidth: 560, padding: "32px" },
  heading: { fontSize: 20, fontWeight: 600, margin: "0 0 8px" },
  text: { color: "#3f3f46", fontSize: 14, lineHeight: "22px", margin: "0 0 12px" },
  label: { color: "#71717a", fontSize: 12, margin: "0 0 2px", textTransform: "uppercase" as const, letterSpacing: 0.5 },
  value: { fontSize: 14, fontWeight: 600, margin: "0 0 12px" },
  button: { backgroundColor: "#18181b", borderRadius: 10, color: "#ffffff", fontSize: 14, padding: "12px 20px", textDecoration: "none" },
  hr: { borderColor: "#e4e4e7", margin: "20px 0" },
  footer: { color: "#a1a1aa", fontSize: 12, margin: 0 },
  pre: { whiteSpace: "pre-wrap" as const, color: "#3f3f46", fontSize: 13, lineHeight: "20px" },
};

/** Default body copy per document kind. */
function intro(props: InvoiceEmailProps): string {
  switch (props.kind) {
    case "quote":
      return `Please find attached quote ${props.invoiceNumber} from ${props.businessName}. It is valid until ${props.dueDate}; you can accept or decline it online.`;
    case "credit_note":
      return `Please find attached credit note ${props.invoiceNumber} from ${props.businessName}${props.sourceNumber ? ` against invoice ${props.sourceNumber}` : ""}. The PDF is attached to this email.`;
    default:
      return `Please find attached invoice ${props.invoiceNumber} from ${props.businessName}. The PDF is attached to this email.`;
  }
}

/** Label/value pairs shown in the summary block. */
function summaryRows(props: InvoiceEmailProps): [string, string][] {
  switch (props.kind) {
    case "quote":
      return [
        ["Quoted amount", props.totalFormatted],
        ["Issued", props.issueDate],
        ["Valid until", props.dueDate],
      ];
    case "credit_note":
      return [
        ["Credit amount", props.totalFormatted],
        ...(props.sourceNumber ? ([["Against invoice", props.sourceNumber]] as [string, string][]) : []),
        ["Date", props.issueDate],
      ];
    default:
      return [
        ["Amount due", props.balanceFormatted],
        ["Invoice total", props.totalFormatted],
        ["Issued", props.issueDate],
        ["Due", props.dueDate],
      ];
  }
}

export function InvoiceEmail(props: InvoiceEmailProps) {
  const label = documentLabel(props.kind);
  return (
    <Html>
      <Head />
      <Preview>
        {label} {props.invoiceNumber} from {props.businessName}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            {label} {props.invoiceNumber}
          </Heading>
          <Text style={styles.text}>Hi {props.clientName},</Text>
          <Text style={styles.text}>{props.message?.trim() || intro(props)}</Text>

          <Section>
            {summaryRows(props).map(([k, v]) => (
              <div key={k}>
                <Text style={styles.label}>{k}</Text>
                <Text style={styles.value}>{v}</Text>
              </div>
            ))}
          </Section>

          {props.viewUrl ? (
            <Section style={{ margin: "8px 0 4px" }}>
              <Button href={props.viewUrl} style={styles.button}>
                {props.kind === "quote" ? "View and respond" : `View ${label.toLowerCase()}`}
              </Button>
            </Section>
          ) : null}

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

export function invoiceEmailText(props: InvoiceEmailProps): string {
  const label = documentLabel(props.kind);
  return [
    `${label} ${props.invoiceNumber} from ${props.businessName}`,
    "",
    `Hi ${props.clientName},`,
    props.message?.trim() || intro(props),
    "",
    ...summaryRows(props).map(([k, v]) => `${k}: ${v}`),
    props.viewUrl ? `\nView online: ${props.viewUrl}` : "",
    props.bankDetails ? `\nPayment details:\n${props.bankDetails}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
