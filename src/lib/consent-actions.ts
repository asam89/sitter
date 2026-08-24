"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Marketing opt-out via the per-user token carried in marketing emails. No
// session is required (people unsubscribe from their inbox), so the token is
// the only thing that identifies the account and it is never logged.
//
// This also has to work for someone who never ticked the newsletter box, since
// they can still be emailed under implied consent — recording newsletterOptOutAt
// is what removes them from every audience.
export async function unsubscribeFromNewsletter(token: string): Promise<void> {
  await prisma.user.updateMany({
    where: { unsubscribeToken: token, newsletterOptOutAt: null },
    data: { newsletterOptIn: false, newsletterOptOutAt: new Date() },
  });
  revalidatePath("/unsubscribe");
}
