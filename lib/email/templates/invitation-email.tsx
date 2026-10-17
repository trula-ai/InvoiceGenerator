import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

export interface InvitationEmailProps {
  appName: string;
  businessName: string;
  /** Who sent the invitation, for context. */
  inviterName: string | null;
  /** Recipient's name when the inviter typed one. */
  name: string | null;
  /** Human-readable role list, e.g. "Salesperson". */
  rolesLabel: string;
  acceptUrl: string;
  expiresInDays: number;
}

const styles = {
  body: { backgroundColor: "#f4f4f5", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" },
  container: { backgroundColor: "#ffffff", borderRadius: 14, margin: "0 auto", maxWidth: 560, padding: "32px" },
  heading: { fontSize: 20, fontWeight: 600, margin: "0 0 8px" },
  text: { color: "#3f3f46", fontSize: 14, lineHeight: "22px", margin: "0 0 12px" },
  button: { backgroundColor: "#18181b", borderRadius: 10, color: "#ffffff", fontSize: 14, padding: "12px 20px", textDecoration: "none" },
  link: { color: "#3f3f46", fontSize: 12, lineHeight: "18px", wordBreak: "break-all" as const },
  hr: { borderColor: "#e4e4e7", margin: "20px 0" },
  footer: { color: "#a1a1aa", fontSize: 12, margin: 0 },
};

function greeting(props: InvitationEmailProps): string {
  return props.name ? `Hi ${props.name},` : "Hi,";
}

function invitedBy(props: InvitationEmailProps): string {
  return props.inviterName ? `${props.inviterName} has invited you` : "You have been invited";
}

export function InvitationEmail(props: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Join {props.businessName} on {props.appName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Join {props.businessName}</Heading>
          <Text style={styles.text}>{greeting(props)}</Text>
          <Text style={styles.text}>
            {invitedBy(props)} to join <strong>{props.businessName}</strong> on {props.appName} as <strong>{props.rolesLabel}</strong>. Click the button below to
            choose a password and get started.
          </Text>

          <Section style={{ margin: "8px 0 4px" }}>
            <Button href={props.acceptUrl} style={styles.button}>
              Accept invitation
            </Button>
          </Section>

          <Text style={styles.text}>
            This link expires in {props.expiresInDays} days and can only be used once. If the button does not work, copy and paste this address into your
            browser:
          </Text>
          <Link href={props.acceptUrl} style={styles.link}>
            {props.acceptUrl}
          </Link>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>If you were not expecting this invitation, you can safely ignore this email.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function invitationEmailText(props: InvitationEmailProps): string {
  return [
    `Join ${props.businessName} on ${props.appName}`,
    "",
    greeting(props),
    `${invitedBy(props)} to join ${props.businessName} on ${props.appName} as ${props.rolesLabel}. Open the link below to choose a password and get started.`,
    "",
    props.acceptUrl,
    "",
    `This link expires in ${props.expiresInDays} days and can only be used once.`,
    "If you were not expecting this invitation, you can safely ignore this email.",
  ].join("\n");
}
