import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readScreeningDocument } from "@/lib/screening";

// Admin-only stream of a sitter's background-check document.
//
// The stored file is encrypted, so this is the only place it exists in the
// clear, and every hit writes a ScreeningAccessLog row *before* the bytes go
// out — "who opened this person's police check" must always be answerable.
// Responses are no-store and inline; nothing is cached or proxied.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    // 404 rather than 403: don't confirm the document exists.
    return new NextResponse("Not found", { status: 404 });
  }

  const row = await prisma.sitterScreening.findUnique({
    where: { id: params.id },
    select: { id: true, storagePath: true, originalMime: true },
  });
  if (!row?.storagePath) return new NextResponse("Not found", { status: 404 });

  await prisma.screeningAccessLog.create({
    data: { screeningId: row.id, adminId: session.user.id },
  });

  let bytes: Buffer;
  try {
    bytes = await readScreeningDocument(row.storagePath);
  } catch (e) {
    // A decryption failure almost always means the key changed.
    console.error(`[screening] cannot read ${row.id}: ${String(e).slice(0, 200)}`);
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.originalMime || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
