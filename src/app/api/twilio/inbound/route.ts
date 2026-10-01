// Inbound SMS/WhatsApp from Twilio.
//
// Without this, a reply to one of our texts is received by Twilio and dropped.
// Point the number's "A message comes in" webhook at
// https://riaya.ca/api/twilio/inbound (HTTP POST) and every reply either
// records an opt-out or reaches the Admin inbox.
//
// The request is authenticated by Twilio's X-Twilio-Signature: an HMAC-SHA1 of
// the full URL plus the POST parameters, keyed with the account's auth token.
// Anything that fails validation is refused, so nobody can forge an opt-out or
// spam the Admin inbox through this route.
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { notifyAdminsOfInboundText } from "@/lib/admin-notifications";
import { inboundIntent } from "@/lib/sms-campaign";

function twilioSignature(url: string, params: Record<string, string>): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", process.env.TWILIO_AUTH_TOKEN ?? "")
    .update(Buffer.from(payload, "utf-8"))
    .digest("base64");
}

function signatureMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Twilio signs the URL it was configured with, which is the public one — behind
// nginx the request itself looks like http://127.0.0.1:3000/...
function publicUrl(req: Request): string {
  const base = (process.env.NEXTAUTH_URL || "https://riaya.ca").replace(
    /\/$/,
    "",
  );
  return `${base}${new URL(req.url).pathname}`;
}

const emptyTwiml = new NextResponse(
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
  { headers: { "Content-Type": "text/xml" } },
);

export async function POST(req: Request) {
  if (!process.env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });
  const provided = req.headers.get("x-twilio-signature") ?? "";
  if (!signatureMatches(twilioSignature(publicUrl(req), params), provided)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // WhatsApp addresses arrive prefixed ("whatsapp:+1..."); accounts store the
  // bare number.
  const from = (params.From ?? "").replace(/^whatsapp:/, "");
  const body = params.Body ?? "";
  const digits = from.replace(/\D/g, "").slice(-10);
  const sender = digits
    ? await prisma.user.findFirst({
        where: { phone: { contains: digits } },
        select: { id: true, name: true, email: true },
      })
    : null;

  switch (inboundIntent(body)) {
    case "STOP":
      if (sender) {
        await prisma.user.update({
          where: { id: sender.id },
          data: { smsOptOutAt: new Date() },
        });
      }
      break;
    case "START":
      if (sender) {
        await prisma.user.update({
          where: { id: sender.id },
          data: { smsOptOutAt: null },
        });
      }
      break;
    default:
      await notifyAdminsOfInboundText({
        from,
        body,
        senderName: sender?.name ?? null,
        senderEmail: sender?.email ?? null,
      });
  }

  return emptyTwiml;
}
