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

// Provider selection. Only the stub is wired today; real providers plug in here
// once the business confirms a vendor and supplies keys (see docs/booking-lifecycle-notes.md).
export function getEmailProvider(): EmailProvider {
  switch (process.env.EMAIL_PROVIDER) {
    // case "resend": return new ResendEmailProvider(process.env.RESEND_API_KEY!);
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
