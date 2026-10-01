// Shared, non-action helpers for newsletter sign-up. Kept out of the "use server"
// modules so client components and pages can use them without pulling server
// actions into the browser bundle.
import { createHash } from "crypto";

export type SubscribeState = {
  error?: string;
  pending?: boolean; // confirmation email sent, awaiting the click
};

export function hashConfirmToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}
