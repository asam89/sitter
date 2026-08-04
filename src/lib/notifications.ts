// Swappable notification providers for KYC verification codes.
//
// Email and SMS delivery sit behind small interfaces so a real provider
// (Resend/SendGrid for email, Twilio for SMS) can be dropped in via env without
// touching call sites. Until keys are configured we use a "stub" provider that
// logs the code to the server console — this keeps the whole verification flow
// exercisable end to end in dev/test.

export interface EmailProvider {
  readonly name: string;
  readonly stub: boolean;
  sendVerificationCode(to: string, code: string): Promise<void>;
}

export interface SmsProvider {
  readonly name: string;
  readonly stub: boolean;
  sendVerificationCode(to: string, code: string): Promise<void>;
}

class StubEmailProvider implements EmailProvider {
  readonly name = "stub";
  readonly stub = true;
  async sendVerificationCode(to: string, code: string) {
    console.info(`[email:stub] verification code for ${to}: ${code}`);
  }
}

class StubSmsProvider implements SmsProvider {
  readonly name = "stub";
  readonly stub = true;
  async sendVerificationCode(to: string, code: string) {
    console.info(`[sms:stub] verification code for ${to}: ${code}`);
  }
}

// Provider selection. Only the stub is wired today; real providers plug in here
// once the business confirms a vendor and supplies keys (see docs/parent-kyc-notes.md).
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
