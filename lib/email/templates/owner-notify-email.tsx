import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

import { emailStyles as styles } from "./styles";

export interface OwnerNotifyEvent {
  invoiceNumber: string;
  clientName: string;
  to: string;
  dueDate: string;
  balanceFormatted: string;
  /** e.g. "7 days before due", "Due today", "12 days overdue". */
  stageLabel: string;
  ok: boolean;
  error?: string;
}

export interface OwnerNotifyPending {
  invoiceNumber: string;
  clientName: string;
  dueDate: string;
  balanceFormatted: string;
  /** e.g. "Due in 3 days", "Due today", "5 days overdue". */
  statusLabel: string;
  overdue: boolean;
}

export interface OwnerNotifyEmailProps {
  businessName: string;
  dateLabel: string;
  events: OwnerNotifyEvent[];
  pending: OwnerNotifyPending[];
  /** One formatted total per currency. */
  pendingTotals: string[];
  dashboardUrl?: string;
}

export function ownerNotifySubject(props: Pick<OwnerNotifyEmailProps, "events" | "pending">): string {
  const sent = props.events.filter((e) => e.ok).length;
  const failed = props.events.length - sent;
  const parts = [
    sent ? `${sent} reminder${sent === 1 ? "" : "s"} sent` : null,
    failed ? `${failed} failed` : null,
    `${props.pending.length} invoice${props.pending.length === 1 ? "" : "s"} pending`,
  ].filter(Boolean);
  return `Payment reminders: ${parts.join(" · ")}`;
}

const cell = { padding: "8px 6px", fontSize: 13, color: "#3f3f46", borderBottom: "1px solid #e4e4e7", verticalAlign: "top" as const };
const head = { ...cell, color: "#71717a", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: 0.5, borderBottom: "2px solid #e4e4e7" };
const right = { textAlign: "right" as const };

export function OwnerNotifyEmail(props: OwnerNotifyEmailProps) {
  const sent = props.events.filter((e) => e.ok);
  const failed = props.events.filter((e) => !e.ok);
  return (
    <Html>
      <Head />
      <Preview>{ownerNotifySubject(props)}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Payment reminders · {props.dateLabel}</Heading>
          <Text style={styles.text}>
            Here is what went out to your clients today and what is still waiting for payment at {props.businessName}.
          </Text>

          {props.events.length ? (
            <Section>
              <Text style={styles.label}>Reminders emailed today</Text>
              <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left" style={head}>
                      Invoice
                    </th>
                    <th align="left" style={head}>
                      Reminder
                    </th>
                    <th align="right" style={{ ...head, ...right }}>
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {props.events.map((e) => (
                    <tr key={`${e.invoiceNumber}-${e.stageLabel}`}>
                      <td style={cell}>
                        <strong>{e.invoiceNumber}</strong>
                        <br />
                        <span style={{ color: "#71717a", fontSize: 12 }}>
                          {e.clientName} · {e.to}
                        </span>
                      </td>
                      <td style={cell}>
                        {e.stageLabel}
                        <br />
                        <span style={{ color: e.ok ? "#059669" : "#dc2626", fontSize: 12 }}>{e.ok ? "Sent" : `Failed: ${e.error ?? "unknown error"}`}</span>
                      </td>
                      <td style={{ ...cell, ...right }}>
                        <strong>{e.balanceFormatted}</strong>
                        <br />
                        <span style={{ color: "#71717a", fontSize: 12 }}>due {e.dueDate}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          <Section style={{ marginTop: 20 }}>
            <Text style={styles.label}>Still pending</Text>
            {props.pending.length ? (
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
                  {props.pending.map((p) => (
                    <tr key={p.invoiceNumber}>
                      <td style={cell}>
                        <strong>{p.invoiceNumber}</strong>
                        <br />
                        <span style={{ color: "#71717a", fontSize: 12 }}>{p.clientName}</span>
                      </td>
                      <td style={cell}>
                        {p.dueDate}
                        <br />
                        <span style={{ color: p.overdue ? "#dc2626" : "#71717a", fontSize: 12 }}>{p.statusLabel}</span>
                      </td>
                      <td style={{ ...cell, ...right }}>
                        <strong>{p.balanceFormatted}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Text style={styles.text}>Nothing is pending. Every issued invoice is paid.</Text>
            )}
            {props.pendingTotals.length ? (
              <>
                <Text style={{ ...styles.label, marginTop: 12 }}>Total outstanding</Text>
                <Text style={styles.value}>{props.pendingTotals.join(" + ")}</Text>
              </>
            ) : null}
          </Section>

          {props.dashboardUrl ? (
            <Section style={{ margin: "8px 0 4px" }}>
              <Button href={props.dashboardUrl} style={styles.button}>
                Open notifications
              </Button>
            </Section>
          ) : null}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Sent by {props.businessName} invoice reminders. {sent.length} sent, {failed.length} failed. Turn this summary off in Settings, Payment
            reminders.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function ownerNotifyEmailText(props: OwnerNotifyEmailProps): string {
  return [
    ownerNotifySubject(props),
    "",
    props.events.length ? "Reminders emailed today:" : "No reminders were emailed today.",
    ...props.events.map(
      (e) => `- ${e.invoiceNumber} · ${e.clientName} · ${e.stageLabel} · ${e.balanceFormatted} due ${e.dueDate} · ${e.ok ? `sent to ${e.to}` : `FAILED: ${e.error ?? "unknown error"}`}`,
    ),
    "",
    props.pending.length ? "Still pending:" : "Nothing is pending.",
    ...props.pending.map((p) => `- ${p.invoiceNumber} · ${p.clientName} · due ${p.dueDate} (${p.statusLabel}) · ${p.balanceFormatted}`),
    props.pendingTotals.length ? `\nTotal outstanding: ${props.pendingTotals.join(" + ")}` : "",
    props.dashboardUrl ? `\nOpen notifications: ${props.dashboardUrl}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
