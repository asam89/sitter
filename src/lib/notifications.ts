// Swappable notification providers for KYC verification codes.
//
// Email and SMS delivery sit behind small interfaces so a real provider
// (Resend/SendGrid for email, Twilio for SMS) can be dropped in via env without
// touching call sites. Until keys are configured we use a "stub" provider that
// logs the code to the server console — this keeps the whole verification flow
// exercisable end to end in dev/test.

// A free-form notification message (used for booking-lifecycle alerts). The
// `subject` is used by channels that support one (email); SMS/WhatsApp use `body`.
export interface NotificationMessage {
  subject: string;
  body: string;
}

export interface EmailProvider {
  readonly name: string;
  readonly stub: boolean;
  sendVerificationCode(to: string, code: string): Promise<void>;
  sendMessage(to: string, msg: NotificationMessage): Promise<void>;
}

export interface SmsProvider {
  readonly name: string;
  readonly stub: boolean;
  sendVerificationCode(to: string, code: string): Promise<void>;
  sendMessage(to: string, msg: NotificationMessage): Promise<void>;
}

// WhatsApp Business messaging (e.g. via Twilio). Same shape as SMS.
export interface WhatsappProvider {
  readonly name: string;
  readonly stub: boolean;
  sendMessage(to: string, msg: NotificationMessage): Promise<void>;
}

class StubEmailProvider implements EmailProvider {
  readonly name = "stub";
  readonly stub = true;
  async sendVerificationCode(to: string, code: string) {
    console.info(`[email:stub] verification code for ${to}: ${code}`);
  }
  async sendMessage(to: string, msg: NotificationMessage) {
    console.info(`[email:stub] to ${to} — ${msg.subject}\n${msg.body}`);
  }
}

class StubSmsProvider implements SmsProvider {
  readonly name = "stub";
  readonly stub = true;
  async sendVerificationCode(to: string, code: string) {
    console.info(`[sms:stub] verification code for ${to}: ${code}`);
  }
  async sendMessage(to: string, msg: NotificationMessage) {
    console.info(`[sms:stub] to ${to} — ${msg.body}`);
  }
}

class StubWhatsappProvider implements WhatsappProvider {
  readonly name = "stub";
  readonly stub = true;
  async sendMessage(to: string, msg: NotificationMessage) {
    console.info(`[whatsapp:stub] to ${to} — ${msg.body}`);
  }
}

// Real email delivery via Resend (https://resend.com) over its REST API — no
// SDK dependency. Enable with EMAIL_PROVIDER=resend, RESEND_API_KEY=..., and
// EMAIL_FROM="Ri'aya <no-reply@yourdomain>".
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  readonly stub = false;
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    // Optional Reply-To (e.g. hello@riaya.ca) so replies reach Ri'aya even while
    // the verified sending domain differs from the from-address.
    private readonly replyTo?: string,
  ) {}

  private async send(to: string, subject: string, text: string) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to,
        subject,
        text,
        ...(this.replyTo ? { reply_to: this.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend send failed (${res.status}): ${detail}`);
    }
  }

  async sendVerificationCode(to: string, code: string) {
    await this.send(
      to,
      "Your Ri'aya verification code",
      `Your Ri'aya verification code is ${code}. It expires shortly.`,
    );
  }

  async sendMessage(to: string, msg: NotificationMessage) {
    await this.send(to, msg.subject, msg.body);
  }
}

// Provider selection. The stub logs to the server console; set EMAIL_PROVIDER to
// switch to a real vendor (see docs/booking-lifecycle-notes.md).
export function getEmailProvider(): EmailProvider {
  switch (process.env.EMAIL_PROVIDER) {
    case "resend":
      return new ResendEmailProvider(
        process.env.RESEND_API_KEY ?? "",
        process.env.EMAIL_FROM ?? "Ri'aya Babysitters <onboarding@resend.dev>",
        process.env.EMAIL_REPLY_TO || undefined,
      );
    default:
      return new StubEmailProvider();
  }
}

export function getSmsProvider(): SmsProvider {
  switch (process.env.SMS_PROVIDER) {
    // case "twilio": return new TwilioSmsProvider(...);
    default:
      return new StubSmsProvider();
  }
}

export function getWhatsappProvider(): WhatsappProvider {
  switch (process.env.WHATSAPP_PROVIDER) {
    // case "twilio": return new TwilioWhatsappProvider(...);
    default:
      return new StubWhatsappProvider();
  }
}
