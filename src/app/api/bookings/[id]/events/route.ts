import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { expandDispatchIfNeeded } from "@/lib/dispatch";

export const dynamic = "force-dynamic";

// Server-Sent Events stream of booking status. Drives real-time
// request → viewing → accepted updates and triggers the dispatch
// fallback-window expansion server-side while a request is pending.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const bookingId = params.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      let lastSnapshot = "";
      const tick = async () => {
        try {
          await expandDispatchIfNeeded(bookingId);
          const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
              sitter: { select: { name: true } },
              dispatchOffers: { select: { status: true } },
            },
          });
          if (!booking) {
            send({ error: "not_found" });
            return;
          }
          if (
            booking.parentId !== session.user.id &&
            booking.sitterId !== session.user.id
          ) {
            send({ error: "forbidden" });
            return;
          }
          const viewing = booking.dispatchOffers.some(
            (o) => o.status === "VIEWED",
          );
          const payload = {
            status: booking.status,
            sitterName: booking.sitter?.name ?? null,
            offers: booking.dispatchOffers.length,
            viewing,
          };
          const snap = JSON.stringify(payload);
          if (snap !== lastSnapshot) {
            lastSnapshot = snap;
            send(payload);
          }
        } catch {
          // swallow; next tick retries
        }
      };

      await tick();
      const interval = setInterval(tick, 2500);

      // Close after 5 minutes to avoid dangling connections.
      const timeout = setTimeout(
        () => {
          closed = true;
          clearInterval(interval);
          controller.close();
        },
        5 * 60 * 1000,
      );

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearTimeout(timeout);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
