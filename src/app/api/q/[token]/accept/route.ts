import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { depositCents, formatCents } from "@/lib/money";
import { canCollectDeposits } from "@/lib/plans";

export const dynamic = "force-dynamic";

// 0.5% platform fee on deposits collected through a connected account.
const APPLICATION_FEE_BPS = 50;

/**
 * Public accept endpoint (no auth — token is the credential).
 * With a deposit: creates a Stripe Checkout session and returns its URL.
 * Without one: marks the quote accepted immediately.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const quote = await prisma.quote.findUnique({
      where: { publicToken: token },
      include: { user: true },
    });
    if (!quote) return jsonError("Quote not found", 404);
    if (quote.status === "accepted") {
      return NextResponse.json({ accepted: true });
    }
    if (!["sent", "viewed"].includes(quote.status)) {
      return jsonError("This quote can no longer be accepted", 409);
    }
    if (quote.expiresAt && quote.expiresAt < new Date()) {
      await prisma.quote.update({ where: { id: quote.id }, data: { status: "expired" } });
      return jsonError("This quote has expired — ask your contractor for a fresh one", 410);
    }

    const deposit = depositCents(quote.totalCents, quote.depositPct);
    const collectDeposit =
      deposit > 0 && canCollectDeposits(quote.user.plan) && !!process.env.STRIPE_SECRET_KEY;

    if (!collectDeposit) {
      await acceptQuote(quote.id, quote.userId);
      return NextResponse.json({ accepted: true });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const business = quote.user.businessName || quote.user.name || "Contractor";
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: quote.clientEmail ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: deposit,
            product_data: {
              name: `Deposit (${quote.depositPct}%) — ${quote.title || "Quote"} from ${business}`,
              description: `Quote total ${formatCents(quote.totalCents)}. Balance due on completion.`,
            },
          },
        },
      ],
      metadata: { kind: "deposit", quoteId: quote.id },
      success_url: `${appUrl}/q/${token}?paid=1`,
      cancel_url: `${appUrl}/q/${token}`,
      ...(quote.user.stripeAccountId
        ? {
            payment_intent_data: {
              transfer_data: { destination: quote.user.stripeAccountId },
              application_fee_amount: Math.round((deposit * APPLICATION_FEE_BPS) / 10000),
            },
          }
        : {}),
    });

    await prisma.payment.create({
      data: {
        quoteId: quote.id,
        type: "deposit",
        amountCents: deposit,
        stripeCheckoutSessionId: session.id,
      },
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    return handleApiError(err);
  }
}

async function acceptQuote(quoteId: string, userId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: { status: "accepted", acceptedAt: now },
    }),
    prisma.followup.updateMany({
      where: { quoteId, status: "scheduled" },
      data: { status: "canceled" },
    }),
    prisma.event.create({
      data: { userId, quoteId, type: "quote.accepted" },
    }),
  ]);
}
