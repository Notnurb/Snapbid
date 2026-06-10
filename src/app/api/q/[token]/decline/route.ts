import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const quote = await prisma.quote.findUnique({ where: { publicToken: token } });
    if (!quote) return jsonError("Quote not found", 404);
    if (!["sent", "viewed"].includes(quote.status)) {
      return jsonError(`Quote is already ${quote.status}`, 409);
    }

    await prisma.$transaction([
      prisma.quote.update({
        where: { id: quote.id },
        data: { status: "declined", declinedAt: new Date() },
      }),
      prisma.followup.updateMany({
        where: { quoteId: quote.id, status: "scheduled" },
        data: { status: "canceled" },
      }),
      prisma.event.create({
        data: { userId: quote.userId, quoteId: quote.id, type: "quote.declined" },
      }),
    ]);

    return NextResponse.json({ declined: true });
  } catch (err) {
    return handleApiError(err);
  }
}
