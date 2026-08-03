import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { messageSchema } from "@/lib/validation";

async function loadParticipantBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { error: "Not found" as const, status: 404 };
  if (booking.parentId !== userId && booking.sitterId !== userId) {
    return { error: "Forbidden" as const, status: 403 };
  }
  return { booking };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await loadParticipantBooking(params.id, session.user.id);
  if ("error" in res)
    return NextResponse.json({ error: res.error }, { status: res.status });

  const messages = await prisma.message.findMany({
    where: { bookingId: params.id },
    orderBy: { sentAt: "asc" },
    include: { sender: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ messages });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await loadParticipantBooking(params.id, session.user.id);
  if ("error" in res)
    return NextResponse.json({ error: res.error }, { status: res.status });

  // Messaging unlocks once a match is accepted — always free, no tier gate.
  const unlocked = ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(
    res.booking.status,
  );
  if (!unlocked) {
    return NextResponse.json(
      { error: "Messaging unlocks once the booking is accepted." },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });

  const message = await prisma.message.create({
    data: {
      bookingId: params.id,
      senderId: session.user.id,
      content: parsed.data.content,
    },
    include: { sender: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ message }, { status: 201 });
}
