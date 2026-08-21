import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { notifyAdminsOfSignup } from "@/lib/admin-notifications";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name, email, password, role, phone, city } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Parents get a profile immediately. Sitters get a User only — they become
  // bookable through the application -> vetting -> listing pipeline.
  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      phone: phone || null,
      parentProfile:
        role === "PARENT" ? { create: { city: city || null } } : undefined,
    },
  });

  await notifyAdminsOfSignup({
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    city: city || null,
  });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
