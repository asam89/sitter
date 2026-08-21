// The exact wording shown next to the (unchecked) newsletter checkbox at
// sign-up. Canada's anti-spam law (CASL) requires express opt-in consent before
// commercial email, so this is stored on the User with the consent timestamp —
// it is the record of what someone actually agreed to.
//
// Kept in its own module so client components can render the wording without
// pulling server-only notification code into the browser bundle.
export const NEWSLETTER_CONSENT_TEXT =
  "Email me Ri'aya news, availability updates and childcare tips. " +
  "I can unsubscribe at any time.";
