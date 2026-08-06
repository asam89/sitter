import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicStorage } from "@/lib/public-storage";

// Streams a sitter's public profile photo. Photos are intentionally public
// (they appear on the Meet our team page), but are stored outside the web root
// so runtime uploads persist across container rebuilds via a mounted volume.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const profile = await prisma.sitterProfile.findUnique({
    where: { id: params.id },
    select: { photoPath: true },
  });
  if (!profile?.photoPath) {
    return new NextResponse("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await getPublicStorage().get(profile.photoPath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = profile.photoPath.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      // Public but short-lived so a replaced photo propagates reasonably fast.
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": "inline",
    },
  });
}
