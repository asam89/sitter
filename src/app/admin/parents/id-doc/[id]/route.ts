import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrivateStorage } from "@/lib/storage";

// Authenticated, Admin-only stream of a pending ID document for review. The raw
// document is NEVER served from the public web root — it is read from private
// storage and streamed here behind an auth check, with no-store caching.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return new NextResponse("Not found", { status: 404 });
  }

  const doc = await prisma.idVerificationDocument.findUnique({
    where: { id: params.id },
  });
  if (!doc || !doc.storagePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await getPrivateStorage().get(doc.storagePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = doc.storagePath.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "pdf"
      ? "application/pdf"
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, private",
      "Content-Disposition": "inline",
    },
  });
}
