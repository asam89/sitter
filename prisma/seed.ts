import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PLACEHOLDER_TERMS_BODY, PLACEHOLDER_TERMS_VERSION } from "../src/lib/terms";

const prisma = new PrismaClient();

async function main() {
  const pw = await bcrypt.hash("password123", 10);

  // Business settings singleton + active placeholder terms.
  await prisma.businessSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  await prisma.termsVersion.upsert({
    where: { version: PLACEHOLDER_TERMS_VERSION },
    update: { active: true },
    create: {
      version: PLACEHOLDER_TERMS_VERSION,
      body: PLACEHOLDER_TERMS_BODY,
      active: true,
    },
  });

  // Ri'aya admin
  await prisma.user.upsert({
    where: { email: "admin@sitbaby.test" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@sitbaby.test",
      name: "Ri'aya Admin",
      passwordHash: pw,
      role: "ADMIN",
    },
  });

  // Parent
  await prisma.user.upsert({
    where: { email: "parent@sitbaby.test" },
    update: {},
    create: {
      email: "parent@sitbaby.test",
      name: "Aisha Parent",
      passwordHash: pw,
      role: "PARENT",
      phone: "+1-905-555-0100",
      parentProfile: { create: { city: "Ajax", address: "12 Maple St, Ajax ON" } },
    },
  });

  // Sitter #1 — vetted AND listed, with an open availability slot in the future.
  const listed = await prisma.user.upsert({
    where: { email: "sitter.listed@sitbaby.test" },
    update: {},
    create: {
      email: "sitter.listed@sitbaby.test",
      name: "Mariam Listed",
      passwordHash: pw,
      role: "SITTER",
      application: {
        create: {
          bio: "Early-childhood educator, 6 years experience.",
          experience: "Nanny for two families, daycare assistant.",
          certifications: ["CPR", "First Aid"],
          documentUrls: ["https://example.com/mariam-cpr.pdf"],
          targetPayRate: 22,
          status: "VETTED",
          reviewedAt: new Date(),
        },
      },
      sitterProfile: {
        create: {
          bio: "Early-childhood educator, 6 years experience.",
          city: "Ajax",
          listedPayRate: 25,
          isListed: true,
        },
      },
    },
    include: { sitterProfile: true },
  });
  if (listed.sitterProfile) {
    const start = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start.getTime() + 4 * 3600 * 1000);
    const existing = await prisma.availabilitySlot.findFirst({
      where: { sitterProfileId: listed.sitterProfile.id },
    });
    if (!existing) {
      await prisma.availabilitySlot.create({
        data: {
          sitterProfileId: listed.sitterProfile.id,
          startTime: start,
          endTime: end,
        },
      });
    }
  }

  // Sitter #2 — vetted but NOT listed (must stay hidden from parents).
  await prisma.user.upsert({
    where: { email: "sitter.unlisted@sitbaby.test" },
    update: {},
    create: {
      email: "sitter.unlisted@sitbaby.test",
      name: "Jordan Unlisted",
      passwordHash: pw,
      role: "SITTER",
      application: {
        create: {
          bio: "Reliable weekend sitter.",
          experience: "Weekend babysitting for neighbours.",
          certifications: ["First Aid"],
          documentUrls: [],
          targetPayRate: 18,
          status: "VETTED",
          reviewedAt: new Date(),
        },
      },
      sitterProfile: {
        create: {
          bio: "Reliable weekend sitter.",
          city: "Whitby",
          listedPayRate: 20,
          isListed: false,
        },
      },
    },
  });

  // Sitter #3 — application awaiting review (no profile yet).
  await prisma.user.upsert({
    where: { email: "sitter.applicant@sitbaby.test" },
    update: {},
    create: {
      email: "sitter.applicant@sitbaby.test",
      name: "Sam Applicant",
      passwordHash: pw,
      role: "SITTER",
      application: {
        create: {
          bio: "New to Ri'aya, lots of family childcare experience.",
          experience: "Cared for younger siblings and cousins for years.",
          certifications: ["CPR"],
          documentUrls: ["https://example.com/sam-cpr.pdf"],
          targetPayRate: 19,
          status: "APPLIED",
        },
      },
    },
  });

  console.log(
    "Seed complete. Login with any *@sitbaby.test / password123 (admin@, parent@, sitter.listed@, sitter.unlisted@, sitter.applicant@)",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
