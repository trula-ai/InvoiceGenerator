import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

import { emailStyles as styles } from "./styles";

export interface ReminderEmailProps {
  businessName: string;
  clientName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  /** Positive when past due, zero or negative when still within terms. */
  daysOverdue: number;
  balanceFormatted: string;
  totalFormatted: string;
  viewUrl?: string;
  message?: string;
  bankDetails?: string | null;
}

export function reminderSubject(props: Pick<ReminderEmailProps, "invoiceNumber" | "businessName" | "daysOverdue">): string {
  return props.daysOverdue > 0
    ? `Overdue: invoice ${props.invoiceNumber} from ${props.businessName}`
    : `Reminder: invoice ${props.invoiceNumber} from ${props.businessName}`;
}

function intro(props: ReminderEmailProps): string {
  if (props.daysOverdue > 0) {
    return `This is a friendly reminder that invoice ${props.invoiceNumber} for ${props.balanceFormatted} was due on ${props.dueDate} and is now ${props.daysOverdue} day${props.daysOverdue === 1 ? "" : "s"} overdue.`;
  }
  if (props.daysOverdue === 0) {
    return `This is a friendly reminder that invoice ${props.invoiceNumber} for ${props.balanceFormatted} is due today.`;
  }
  const daysLeft = -props.daysOverdue;
  return `This is a friendly reminder that invoice ${props.invoiceNumber} for ${props.balanceFormatted} is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}, on ${props.dueDate}.`;
}

export function ReminderEmail(props: ReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{intro(props)}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{props.daysOverdue > 0 ? "Payment overdue" : "Payment reminder"}</Heading>
          <Text style={styles.text}>Hi {props.clientName},</Text>
          <Text style={styles.text}>{props.message?.trim() || intro(props)}</Text>
          <Text style={styles.text}>If you have already paid, please ignore this email. Otherwise, the invoice PDF is attached for your reference.</Text>

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

export function reminderEmailText(props: ReminderEmailProps): string {
  return [
    reminderSubject(props),
    "",
    `Hi ${props.clientName},`,
    props.message?.trim() || intro(props),
    "If you have already paid, please ignore this email.",
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
