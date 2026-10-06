import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

import { emailStyles as styles } from "./styles";

export interface ReceiptEmailProps {
  businessName: string;
  clientName: string;
  receiptNumber: string;
  invoiceNumber: string;
  paymentDate: string;
  method: string;
  reference?: string | null;
  amountFormatted: string;
  balanceFormatted: string;
  settled: boolean;
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
              `${props.businessName} has received your payment of ${props.amountFormatted} against invoice ${props.invoiceNumber}. The receipt is attached as a PDF.`}
          </Text>

          <Section>
            <Text style={styles.label}>Receipt</Text>
            <Text style={styles.value}>{props.receiptNumber}</Text>
            <Text style={styles.label}>Amount received</Text>
            <Text style={styles.value}>{props.amountFormatted}</Text>
            <Text style={styles.label}>Payment date</Text>
            <Text style={styles.value}>{props.paymentDate}</Text>
            <Text style={styles.label}>Method</Text>
            <Text style={styles.value}>
              {props.method}
              {props.reference ? ` · ${props.reference}` : ""}
            </Text>
            <Text style={styles.label}>{props.settled ? "Invoice status" : "Remaining balance"}</Text>
            <Text style={styles.value}>{props.settled ? "Paid in full" : props.balanceFormatted}</Text>
          </Section>

          {props.viewUrl ? (
            <Section style={{ margin: "8px 0 4px" }}>
              <Button href={props.viewUrl} style={styles.button}>
                View invoice
              </Button>
            </Section>
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
    props.message?.trim() || `We have received your payment of ${props.amountFormatted} against invoice ${props.invoiceNumber}.`,
    "",
    `Receipt: ${props.receiptNumber}`,
    `Amount received: ${props.amountFormatted}`,
    `Payment date: ${props.paymentDate}`,
    `Method: ${props.method}${props.reference ? ` (${props.reference})` : ""}`,
    props.settled ? "Invoice status: Paid in full" : `Remaining balance: ${props.balanceFormatted}`,
    props.viewUrl ? `\nView invoice: ${props.viewUrl}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
