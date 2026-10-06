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

export interface InvoiceEmailProps {
  businessName: string;
  clientName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalFormatted: string;
  balanceFormatted: string;
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

export function InvoiceEmail(props: InvoiceEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Invoice {props.invoiceNumber} from {props.businessName}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Invoice {props.invoiceNumber}</Heading>
          <Text style={styles.text}>Hi {props.clientName},</Text>
          <Text style={styles.text}>
            {props.message?.trim() ||
              `Please find attached invoice ${props.invoiceNumber} from ${props.businessName}. The PDF is attached to this email.`}
          </Text>

          <Section>
            <Text style={styles.label}>Amount due</Text>
            <Text style={styles.value}>{props.balanceFormatted}</Text>
            <Text style={styles.label}>Invoice total</Text>
            <Text style={styles.value}>{props.totalFormatted}</Text>
            <Text style={styles.label}>Issued</Text>
            <Text style={styles.value}>{props.issueDate}</Text>
            <Text style={styles.label}>Due</Text>
            <Text style={styles.value}>{props.dueDate}</Text>
          </Section>

          {props.viewUrl ? (
            <Section style={{ margin: "8px 0 4px" }}>
              <Button href={props.viewUrl} style={styles.button}>
                View invoice
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
  return [
    `Invoice ${props.invoiceNumber} from ${props.businessName}`,
    "",
    `Hi ${props.clientName},`,
    props.message?.trim() || `Please find attached invoice ${props.invoiceNumber}.`,
    "",
    `Amount due: ${props.balanceFormatted}`,
    `Invoice total: ${props.totalFormatted}`,
    `Issued: ${props.issueDate}`,
    `Due: ${props.dueDate}`,
    props.viewUrl ? `\nView online: ${props.viewUrl}` : "",
    props.bankDetails ? `\nPayment details:\n${props.bankDetails}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
