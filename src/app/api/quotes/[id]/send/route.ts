import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sendQuoteEmail } from "@/lib/email";
import { hasAutoFollowups } from "@/lib/plans";

export const dynamic = "force-dynamic";

const QUOTE_VALID_DAYS = 14;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await prisma.quote.findFirst({
      where: { id, userId: user.id },
      include: { items: true },
    });
    if (!existing) return jsonError("Quote not found", 404);
    if (existing.status === "accepted" || existing.status === "declined") {
      return jsonError(`Quote is already ${existing.status}`, 409);
    }
    if (existing.items.length === 0) {
      return jsonError("Add at least one line item before sending");
    }
    if (existing.items.some((it) => it.unitPriceCents == null)) {
      return jsonError("Every line item needs a price before sending");
    }

    const clientEmail =
      typeof body.clientEmail === "string" && body.clientEmail.includes("@")
        ? body.clientEmail.slice(0, 200)
        : existing.clientEmail;
    if (!clientEmail) return jsonError("Client email is required to send");

    const now = new Date();
    const quote = await prisma.quote.update({
      where: { id },
      data: {
        clientEmail,
        clientName:
          typeof body.clientName === "string"
            ? body.clientName.slice(0, 100)
            : existing.clientName,
        status: "sent",
        sentAt: now,
        expiresAt: new Date(now.getTime() + QUOTE_VALID_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await sendQuoteEmail(user, quote);

    // Auto follow-ups at 24h and 72h (Crew plan). Re-sending reschedules.
    await prisma.followup.updateMany({
      where: { quoteId: id, status: "scheduled" },
      data: { status: "canceled" },
    });
    if (hasAutoFollowups(user.plan)) {
      await prisma.followup.createMany({
        data: [
          { quoteId: id, kind: "24h", dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
          { quoteId: id, kind: "72h", dueAt: new Date(now.getTime() + 72 * 60 * 60 * 1000) },
        ],
      });
    }

    await prisma.event.create({
      data: { userId: user.id, quoteId: id, type: "quote.sent", data: { clientEmail } },
    });

    return NextResponse.json({ quote });
  } catch (err) {
    return handleApiError(err);
  }
}
