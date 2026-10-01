import type { ActionResult } from "@/lib/sitter-profile-actions";

const FALLBACK: ActionResult = {
  ok: false,
  error:
    "That didn't go through. Refresh the page (you may need to log in again) and try once more.",
};

// A server action resolves to undefined when the server answers with a
// redirect (e.g. an expired login) or a non-action response (e.g. an older
// page calling a newer deployment), and rejects on network errors.
export async function runAction(
  call: () => Promise<ActionResult | undefined>,
): Promise<ActionResult> {
  try {
    return (await call()) ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}
