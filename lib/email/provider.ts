import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

/**
 * Email provider abstraction.
 *
 * The rest of the app only talks to `EmailProvider`. Swap providers by adding
 * a class here and changing `getEmailProvider()`; nothing else needs to know.
 *
 * Selection order:
 * - SmtpProvider: used when SMTP_HOST is set (any SMTP relay: Gmail, Zoho,
 *   Outlook, SES, Mailgun, ...). Authenticates with SMTP_USER / SMTP_PASS.
 * - ResendProvider: used when RESEND_API_KEY is set and SMTP is not.
 * - ConsoleProvider: development fallback that prints the message to the
 *   server console instead of sending. Logged with provider "console" so it is
 *   obvious in the email history that nothing left the machine.
 */

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSendResult {
  messageId: string | null;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function defaultFromAddress(): string {
  return env("EMAIL_FROM") || env("SMTP_FROM") || env("SMTP_USER") || "Invoice Generator <onboarding@resend.dev>";
}

class SmtpProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: Transporter;

  constructor() {
    const port = Number(env("SMTP_PORT") || 587);
    const secureFlag = env("SMTP_SECURE").toLowerCase();
    const secure = secureFlag ? secureFlag === "true" || secureFlag === "1" : port === 465;
    const user = env("SMTP_USER");
    const pass = env("SMTP_PASS") || env("SMTP_PASSWORD");
    this.transporter = nodemailer.createTransport({
      host: env("SMTP_HOST"),
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const info = await this.transporter.sendMail({
      from: defaultFromAddress(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { messageId: info.messageId ?? null };
  }
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const { data, error } = await this.client.emails.send({
      from: defaultFromAddress(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    if (error) throw new Error(`${error.name}: ${error.message}`);
    return { messageId: data?.id ?? null };
  }
}

class ConsoleProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const id = `console-${Date.now()}`;
    console.info(
      [
        "",
        "========= EMAIL (not sent: neither SMTP_HOST nor RESEND_API_KEY is set) =========",
        `From:    ${defaultFromAddress()}`,
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        `Attachments: ${message.attachments?.map((a) => `${a.filename} (${a.content.length} bytes)`).join(", ") || "none"}`,
        "----------------------------------------------------------------------------",
        message.text ?? "(html only)",
        "============================================================================",
        "",
      ].join("\n"),
    );
    return { messageId: id };
  }
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  if (env("SMTP_HOST")) cached = new SmtpProvider();
  else if (env("RESEND_API_KEY")) cached = new ResendProvider(env("RESEND_API_KEY"));
  else cached = new ConsoleProvider();
  return cached;
}

export function isEmailConfigured(): boolean {
  return !!(env("SMTP_HOST") || env("RESEND_API_KEY"));
}
