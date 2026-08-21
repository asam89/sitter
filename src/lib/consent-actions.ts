"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Newsletter opt-out via the per-user token carried in marketing emails. No
// session is required (people unsubscribe from their inbox), so the token is
// the only thing that identifies the account and it is never logged.
export async function unsubscribeFromNewsletter(token: string): Promise<void> {
  await prisma.user.updateMany({
    where: { unsubscribeToken: token, newsletterOptIn: true },
    data: { newsletterOptIn: false, newsletterOptOutAt: new Date() },
  });
  revalidatePath("/unsubscribe");
}
