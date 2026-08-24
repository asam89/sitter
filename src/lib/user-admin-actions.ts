"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

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
    throw new Error("This is the last active Admin — promote someone else first.");
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
