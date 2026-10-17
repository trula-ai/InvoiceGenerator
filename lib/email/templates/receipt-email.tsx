import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

import { emailStyles as styles } from "./styles";

export interface ReceiptEmailProps {
  businessName: string;
  clientName: string;
  receiptNumber: string;
  invoiceNumber: string;
  paymentDate: string;
  method: string;
  reference?: string | null;
  /** Paid now. */
  amountFormatted: string;
  invoiceTotalFormatted: string;
  /** Total paid so far, including this payment. */
  cumulativeFormatted: string;
  /** Balance outstanding after this payment. */
  balanceFormatted: string;
  dueDate: string;
  settled: boolean;
  termsText?: string | null;
  privacyUrl?: string | null;
  viewUrl?: string;
  message?: string;
}

export function ReceiptEmail(props: ReceiptEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Payment received: {props.amountFormatted} against {props.invoiceNumber}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Thank you for your payment</Heading>
          <Text style={styles.text}>Hi {props.clientName},</Text>
          <Text style={styles.text}>
            {props.message?.trim() ||
              `${props.businessName} has received your payment of ${props.amountFormatted} against invoice ${props.invoiceNumber}. Your receipt is attached as a PDF.`}
          </Text>

          <Section>
            <Text style={styles.label}>Receipt</Text>
            <Text style={styles.value}>{props.receiptNumber}</Text>
            <Text style={styles.label}>Paid now</Text>
            <Text style={styles.value}>{props.amountFormatted}</Text>
            <Text style={styles.label}>Payment date</Text>
            <Text style={styles.value}>{props.paymentDate}</Text>
            <Text style={styles.label}>Method</Text>
            <Text style={styles.value}>
              {props.method}
              {props.reference ? ` · ${props.reference}` : ""}
            </Text>
            <Text style={styles.label}>Invoice amount</Text>
            <Text style={styles.value}>{props.invoiceTotalFormatted}</Text>
            <Text style={styles.label}>Total paid so far</Text>
            <Text style={styles.value}>{props.cumulativeFormatted}</Text>
            <Text style={styles.label}>Balance outstanding</Text>
            <Text style={styles.value}>{props.settled ? `${props.balanceFormatted} · paid in full` : `${props.balanceFormatted} · due by ${props.dueDate}`}</Text>
          </Section>

          {props.viewUrl ? (
            <Section style={{ margin: "8px 0 4px" }}>
              <Button href={props.viewUrl} style={styles.button}>
                View invoice
              </Button>
            </Section>
          ) : null}

          {props.termsText || props.privacyUrl ? (
            <>
              <Hr style={styles.hr} />
              {props.termsText ? <Text style={styles.footer}>{props.termsText}</Text> : null}
              {props.privacyUrl ? (
                <Text style={styles.footer}>
                  Privacy policy: <Link href={props.privacyUrl}>{props.privacyUrl}</Link>
                </Text>
              ) : null}
            </>
          ) : null}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>Sent by {props.businessName}. Reply to this email if anything looks wrong.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function receiptEmailText(props: ReceiptEmailProps): string {
  return [
    `Payment receipt ${props.receiptNumber} from ${props.businessName}`,
    "",
    `Hi ${props.clientName},`,
    props.message?.trim() || `We have received your payment of ${props.amountFormatted} against invoice ${props.invoiceNumber}. Your receipt is attached.`,
    "",
    `Receipt: ${props.receiptNumber}`,
    `Paid now: ${props.amountFormatted}`,
    `Payment date: ${props.paymentDate}`,
    `Method: ${props.method}${props.reference ? ` (${props.reference})` : ""}`,
    `Invoice amount: ${props.invoiceTotalFormatted}`,
    `Total paid so far: ${props.cumulativeFormatted}`,
    props.settled ? `Balance outstanding: ${props.balanceFormatted} (paid in full)` : `Balance outstanding: ${props.balanceFormatted}, due by ${props.dueDate}`,
    props.viewUrl ? `\nView invoice: ${props.viewUrl}` : "",
    props.termsText ? `\n${props.termsText}` : "",
    props.privacyUrl ? `Privacy policy: ${props.privacyUrl}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
