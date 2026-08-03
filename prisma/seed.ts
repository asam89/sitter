import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const pw = await bcrypt.hash("password123", 10);

  // Platform admin
  await prisma.user.upsert({
    where: { email: "admin@circlecare.test" },
    update: {},
    create: {
      email: "admin@circlecare.test",
      name: "Platform Admin",
      passwordHash: pw,
      role: "PLATFORM_ADMIN",
    },
  });

  // Seed community partner — FaezSports (the first partner onboarded via the
  // generic partner flow; nothing FaezSports-specific is hardcoded).
  const faez = await prisma.communityPartner.upsert({
    where: { id: "seed-faezsports" },
    update: { status: "APPROVED" },
    create: {
      id: "seed-faezsports",
      name: "FaezSports",
      type: "SPORTS_LEAGUE",
      status: "APPROVED",
      city: "Durham",
      description:
        "GTA/Durham community sports league — CircleCare's founding community partner.",
    },
  });

  // Community admin for FaezSports
  await prisma.user.upsert({
    where: { email: "faez.admin@circlecare.test" },
    update: {},
    create: {
      email: "faez.admin@circlecare.test",
      name: "Faez Admin",
      passwordHash: pw,
      role: "COMMUNITY_ADMIN",
      affiliations: {
        create: {
          communityPartnerId: faez.id,
          role: "ADMIN",
          status: "APPROVED",
        },
      },
    },
  });

  // Parent affiliated with FaezSports
  await prisma.user.upsert({
    where: { email: "parent@circlecare.test" },
    update: {},
    create: {
      email: "parent@circlecare.test",
      name: "Aisha Parent",
      passwordHash: pw,
      role: "PARENT",
      phone: "+1-905-555-0100",
      parentProfile: {
        create: {
          city: "Ajax",
          address: "12 Community Way, Ajax ON",
          lat: 43.85,
          lng: -79.02,
        },
      },
      affiliations: {
        create: {
          communityPartnerId: faez.id,
          role: "MEMBER",
          status: "APPROVED",
        },
      },
    },
  });

  // Community-endorsed sitter
  const endorsed = await prisma.user.upsert({
    where: { email: "sitter.endorsed@circlecare.test" },
    update: {},
    create: {
      email: "sitter.endorsed@circlecare.test",
      name: "Mariam Endorsed",
      passwordHash: pw,
      role: "SITTER",
      sitterProfile: {
        create: {
          bio: "Early-childhood educator, 6 years experience. FaezSports volunteer.",
          hourlyRate: 22,
          serviceRadiusKm: 20,
          isAvailableNow: true,
          verificationStatus: "PLATFORM_VERIFIED",
          languages: ["English", "Arabic"],
          certifications: ["First Aid", "CPR"],
          city: "Ajax",
          lat: 43.86,
          lng: -79.03,
        },
      },
      affiliations: {
        create: {
          communityPartnerId: faez.id,
          role: "MEMBER",
          status: "APPROVED",
        },
      },
    },
    include: { sitterProfile: true },
  });
  if (endorsed.sitterProfile) {
    await prisma.endorsement.upsert({
      where: {
        sitterProfileId_communityPartnerId: {
          sitterProfileId: endorsed.sitterProfile.id,
          communityPartnerId: faez.id,
        },
      },
      update: { status: "APPROVED" },
      create: {
        sitterProfileId: endorsed.sitterProfile.id,
        communityPartnerId: faez.id,
        status: "APPROVED",
      },
    });
  }

  // Platform-verified-only sitter (no community endorsement)
  await prisma.user.upsert({
    where: { email: "sitter.platform@circlecare.test" },
    update: {},
    create: {
      email: "sitter.platform@circlecare.test",
      name: "Jordan Verified",
      passwordHash: pw,
      role: "SITTER",
      sitterProfile: {
        create: {
          bio: "Reliable weekend sitter. Background check on file.",
          hourlyRate: 18,
          serviceRadiusKm: 25,
          isAvailableNow: true,
          verificationStatus: "PLATFORM_VERIFIED",
          languages: ["English"],
          certifications: ["First Aid"],
          city: "Whitby",
          lat: 43.9,
          lng: -78.94,
        },
      },
    },
  });

  console.log("Seed complete. Login with any *@circlecare.test / password123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
