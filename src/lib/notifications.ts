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

// Real SMS / WhatsApp delivery via Twilio's REST API (no SDK dependency).
//
// SMS: SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN and either
// TWILIO_SMS_FROM (an E.164 number you own) or TWILIO_MESSAGING_SERVICE_SID.
// WhatsApp: WHATSAPP_PROVIDER=twilio + TWILIO_WHATSAPP_FROM ("whatsapp:+1...").
//
// Twilio requires the destination to be E.164 (+15551234567); phone numbers are
// user-entered so we normalise the common Canadian/US 10-digit form here rather
// than failing the send.
function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

class TwilioMessagingProvider {
  readonly stub = false;
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    // Either a from-number or a messaging service; Twilio needs exactly one.
    private readonly from: string | undefined,
    private readonly messagingServiceSid: string | undefined,
    // WhatsApp addresses are prefixed ("whatsapp:+1...") on both ends.
    private readonly prefix: "" | "whatsapp:" = "",
  ) {}

  protected async sendText(to: string, body: string) {
    const params = new URLSearchParams({
      To: `${this.prefix}${toE164(to)}`,
      Body: body,
    });
    if (this.messagingServiceSid) {
      params.set("MessagingServiceSid", this.messagingServiceSid);
    } else if (this.from) {
      params.set("From", `${this.prefix}${toE164(this.from)}`);
    } else {
      throw new Error(
        "Twilio needs TWILIO_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID",
      );
    }
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.accountSid}:${this.authToken}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Twilio send failed (${res.status}): ${detail}`);
    }
  }
}

class TwilioSmsProvider extends TwilioMessagingProvider implements SmsProvider {
  readonly name = "twilio";
  async sendVerificationCode(to: string, code: string) {
    await this.sendText(to, `Your Ri'aya verification code is ${code}.`);
  }
  async sendMessage(to: string, msg: NotificationMessage) {
    await this.sendText(to, msg.body);
  }
}

class TwilioWhatsappProvider
  extends TwilioMessagingProvider
  implements WhatsappProvider
{
  readonly name = "twilio";
  async sendMessage(to: string, msg: NotificationMessage) {
    await this.sendText(to, msg.body);
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
    case "twilio":
      return new TwilioSmsProvider(
        process.env.TWILIO_ACCOUNT_SID ?? "",
        process.env.TWILIO_AUTH_TOKEN ?? "",
        process.env.TWILIO_SMS_FROM || undefined,
        process.env.TWILIO_MESSAGING_SERVICE_SID || undefined,
      );
    default:
      return new StubSmsProvider();
  }
}

export function getWhatsappProvider(): WhatsappProvider {
  switch (process.env.WHATSAPP_PROVIDER) {
    case "twilio":
      return new TwilioWhatsappProvider(
        process.env.TWILIO_ACCOUNT_SID ?? "",
        process.env.TWILIO_AUTH_TOKEN ?? "",
        process.env.TWILIO_WHATSAPP_FROM || undefined,
        undefined,
        "whatsapp:",
      );
    default:
      return new StubWhatsappProvider();
  }
}
