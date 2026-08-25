"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { adminCreateUserSchema } from "@/lib/validation";
import { sendAccountSetupInvite } from "@/lib/password-reset";
import { notifyAdminsOfSignup } from "@/lib/admin-notifications";

// Account administration: who can sign in, and who has Admin privileges.
//
// Guard rails, because a mistake here either locks everyone out of the
// dashboard or hands it to the wrong person:
//   - an Admin cannot change their own role (no accidental self-demotion);
//   - the last remaining Admin cannot be demoted or suspended;
//   - a role change is refused while the account still has bookings in flight
//     in that role, since it would strand the other party;
//   - every change is written to AdminAuditLog with who did it.

export type UserAdminState = { error?: string; ok?: string };

const IN_FLIGHT = ["REQUESTED", "APPROVED", "IN_PROGRESS"] as const;

async function inFlightBookings(userId: string): Promise<number> {
  return prisma.booking.count({
    where: {
      status: { in: [...IN_FLIGHT] },
      OR: [{ parentId: userId }, { sitterId: userId }],
    },
  });
}

async function otherAdminCount(userId: string): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", suspended: false, id: { not: userId } },
  });
}

export async function setUserRole(
  _prev: UserAdminState,
  fd: FormData,
): Promise<UserAdminState> {
  const admin = await requireRole("ADMIN");
  const userId = String(fd.get("userId") ?? "");
  const role = String(fd.get("role") ?? "") as Role;
  if (!["PARENT", "SITTER", "ADMIN"].includes(role)) {
    return { error: "Unknown role." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "That account no longer exists." };
  if (target.role === role) return { ok: `${target.name} is already ${role}.` };
  if (target.id === admin.id) {
    return {
      error:
        "You can't change your own role — ask the other Admin to do it, so " +
        "nobody locks themselves out.",
    };
  }
  if (target.role === "ADMIN" && (await otherAdminCount(target.id)) === 0) {
    return {
      error: "This is the last active Admin. Promote someone else first.",
    };
  }
  const inFlight = await inFlightBookings(target.id);
  if (inFlight > 0) {
    return {
      error:
        `${target.name} has ${inFlight} booking(s) in flight. Let those ` +
        `finish or cancel them before changing the role.`,
    };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { role } }),
    prisma.adminAuditLog.create({
      data: {
        actorId: admin.id,
        targetUserId: target.id,
        action: `role:${target.role}->${role}`,
        detail: target.email,
      },
    }),
  ]);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: `${target.name} is now ${role.toLowerCase()}.` };
}

// An Admin creating an account for a family or sitter who signed up by phone or
// in person. No password is chosen for them: the account carries an unusable
// random hash until they redeem the emailed set-password link, so an Admin never
// knows (or has to transmit) someone else's credentials.
//
// A sitter created here gets a vetted SitterProfile directly, skipping the
// application form — the Admin has already done the vetting off-app. Listing is
// still a separate, deliberate action, so this can't accidentally make someone
// publicly bookable.
export async function adminCreateUser(
  _prev: UserAdminState,
  fd: FormData,
): Promise<UserAdminState> {
  const admin = await requireRole("ADMIN");
  const role = String(fd.get("role") ?? "");
  const parsed = adminCreateUserSchema.safeParse({
    name: fd.get("name"),
    email: fd.get("email"),
    role,
    phone: fd.get("phone") ?? "",
    city: fd.get("city") ?? "",
    ...(role === "SITTER" ? { listedPayRate: fd.get("listedPayRate") } : {}),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Check the details and try again.",
    };
  }
  const { name, email, phone, city, listedPayRate } = parsed.data;
  const normalisedEmail = email.toLowerCase();

  if (parsed.data.role === "SITTER" && !listedPayRate) {
    return { error: "Set the sitter's hourly rate." };
  }

  const clash = await prisma.user.findUnique({
    where: { email: normalisedEmail },
  });
  if (clash) {
    return {
      error: `${normalisedEmail} already has an account (${clash.role.toLowerCase()}).`,
    };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: normalisedEmail,
      // Unusable by design — replaced when the invitee sets their own password.
      passwordHash: randomBytes(32).toString("hex"),
      role: parsed.data.role,
      phone: phone || null,
      unsubscribeToken: randomBytes(24).toString("hex"),
      parentProfile:
        parsed.data.role === "PARENT"
          ? { create: { city: city || null } }
          : undefined,
      sitterProfile:
        parsed.data.role === "SITTER"
          ? {
              create: {
                city: city || null,
                listedPayRate: listedPayRate ?? 0,
                isListed: false,
              },
            }
          : undefined,
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      actorId: admin.id,
      targetUserId: user.id,
      action: `create:${user.role}`,
      detail: user.email,
    },
  });

  // Best-effort: the account exists either way, and an Admin can resend the
  // invite from the user list.
  await sendAccountSetupInvite({
    id: user.id,
    email: user.email,
    name: user.name,
    role: parsed.data.role,
  }).catch((e) => console.error("[admin-create-user] invite failed:", e));

  await notifyAdminsOfSignup({
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    city: city || null,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect(`/admin/users?q=${encodeURIComponent(user.email)}&invited=1`);
}

// Re-sends the set-password invitation for an account that has never signed in.
export async function resendAccountInvite(userId: string) {
  await requireRole("ADMIN");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.role === "ADMIN") {
    throw new Error("Admins reset their own password from the login page.");
  }
  await sendAccountSetupInvite({
    id: target.id,
    email: target.email,
    name: target.name,
    role: target.role === "SITTER" ? "SITTER" : "PARENT",
  });
  revalidatePath("/admin/users");
}

export async function setUserSuspendedAudited(
  userId: string,
  suspended: boolean,
) {
  const admin = await requireRole("ADMIN");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.id === admin.id) {
    throw new Error("You can't suspend your own account.");
  }
  if (
    suspended &&
    target.role === "ADMIN" &&
    (await otherAdminCount(target.id)) === 0
  ) {
    throw new Error(
      "This is the last active Admin — promote someone else first.",
    );
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { suspended } }),
    prisma.adminAuditLog.create({
      data: {
        actorId: admin.id,
        targetUserId: target.id,
        action: suspended ? "suspend" : "unsuspend",
        detail: target.email,
      },
    }),
  ]);

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}
