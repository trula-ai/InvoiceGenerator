import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

export interface PasswordResetEmailProps {
  appName: string;
  /** Recipient's display name. */
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
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

export function PasswordResetEmail(props: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your {props.appName} password</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Reset your password</Heading>
          <Text style={styles.text}>Hi {props.name},</Text>
          <Text style={styles.text}>
            We received a request to reset the password for your {props.appName} account. Click the button below to choose a new one.
          </Text>

          <Section style={{ margin: "8px 0 4px" }}>
            <Button href={props.resetUrl} style={styles.button}>
              Choose a new password
            </Button>
          </Section>

          <Text style={styles.text}>
            This link expires in {props.expiresInMinutes} minutes and can only be used once. If the button does not work, copy and paste this
            address into your browser:
          </Text>
          <Link href={props.resetUrl} style={styles.link}>
            {props.resetUrl}
          </Link>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            If you did not ask to reset your password, you can safely ignore this email. Your password will not change.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function passwordResetEmailText(props: PasswordResetEmailProps): string {
  return [
    `Reset your ${props.appName} password`,
    "",
    `Hi ${props.name},`,
    `We received a request to reset the password for your ${props.appName} account. Open the link below to choose a new one.`,
    "",
    props.resetUrl,
    "",
    `This link expires in ${props.expiresInMinutes} minutes and can only be used once.`,
    "If you did not ask to reset your password, you can safely ignore this email. Your password will not change.",
  ].join("\n");
}
