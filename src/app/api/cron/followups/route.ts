import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendFollowupEmail } from "@/lib/email";
import { hasAutoFollowups } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hit by Vercel cron every 15 minutes (see vercel.json).
 * 1. Expires quotes past their expiry date.
 * 2. Sends due follow-up emails for quotes that haven't been accepted/declined.
 */
export async function GET(req: Request) {
  // Vercel cron sends Authorization: Bearer CRON_SECRET when the env var is set.
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // Expire stale quotes and cancel their pending follow-ups.
  const expired = await prisma.quote.findMany({
    where: { status: { in: ["sent", "viewed"] }, expiresAt: { lt: now } },
    select: { id: true },
  });
  if (expired.length > 0) {
    const ids = expired.map((q) => q.id);
    await prisma.$transaction([
      prisma.quote.updateMany({
        where: { id: { in: ids } },
        data: { status: "expired" },
      }),
      prisma.followup.updateMany({
        where: { quoteId: { in: ids }, status: "scheduled" },
        data: { status: "canceled" },
      }),
    ]);
  }

  // Send due follow-ups.
  const due = await prisma.followup.findMany({
    where: { status: "scheduled", dueAt: { lte: now } },
    include: { quote: { include: { user: true } } },
    take: 50,
  });

  let sent = 0;
  let canceled = 0;
  for (const followup of due) {
    const { quote } = followup;
    const stillOpen = ["sent", "viewed"].includes(quote.status);
    if (!stillOpen || !hasAutoFollowups(quote.user.plan) || !quote.clientEmail) {
      await prisma.followup.update({
        where: { id: followup.id },
        data: { status: "canceled" },
      });
      canceled++;
      continue;
    }
    try {
      await sendFollowupEmail(quote.user, quote, followup.kind);
      await prisma.$transaction([
        prisma.followup.update({
          where: { id: followup.id },
          data: { status: "sent", sentAt: new Date() },
        }),
        prisma.event.create({
          data: {
            userId: quote.userId,
            quoteId: quote.id,
            type: "followup.sent",
            data: { kind: followup.kind },
          },
        }),
      ]);
      sent++;
    } catch (err) {
      console.error(`Follow-up ${followup.id} failed`, err);
    }
  }

  return NextResponse.json({ expired: expired.length, sent, canceled });
}
