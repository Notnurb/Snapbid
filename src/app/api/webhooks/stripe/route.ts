import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type { Plan } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const payload = await req.text();
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("Stripe signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "payment" && session.metadata?.kind === "deposit") {
          await handleDepositPaid(session);
        } else if (session.mode === "subscription") {
          await handleSubscriptionStarted(session);
        }
        break;
      }
      case "customer.subscription.updated": {
        await syncSubscription(event.data.object);
        break;
      }
      case "customer.subscription.deleted": {
        await downgradeByCustomer(event.data.object.customer as string);
        break;
      }
    }
  } catch (err) {
    console.error(`Error handling ${event.type}`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleDepositPaid(session: Stripe.Checkout.Session) {
  const quoteId = session.metadata?.quoteId;
  if (!quoteId) return;

  const now = new Date();
  const payment = await prisma.payment.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  });

  await prisma.$transaction([
    ...(payment
      ? [
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "paid" as const,
              paidAt: now,
              stripePaymentIntentId:
                typeof session.payment_intent === "string" ? session.payment_intent : null,
            },
          }),
        ]
      : []),
    prisma.quote.update({
      where: { id: quoteId },
      data: { status: "accepted", acceptedAt: now },
    }),
    prisma.followup.updateMany({
      where: { quoteId, status: "scheduled" },
      data: { status: "canceled" },
    }),
    prisma.event.create({
      data: {
        quoteId,
        type: "payment.succeeded",
        data: { amountCents: session.amount_total ?? 0, sessionId: session.id },
      },
    }),
  ]);
}

async function handleSubscriptionStarted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  if (!userId || (plan !== "pro" && plan !== "crew")) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: plan as Plan,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
    },
  });
  await prisma.event.create({
    data: { userId, type: "subscription.started", data: { plan } },
  });
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (sub.status === "canceled" || sub.status === "unpaid") {
    await downgradeByCustomer(customerId);
    return;
  }
  const priceId = sub.items.data[0]?.price.id;
  const plan: Plan | null =
    priceId === process.env.STRIPE_CREW_PRICE_ID
      ? "crew"
      : priceId === process.env.STRIPE_PRO_PRICE_ID
        ? "pro"
        : null;
  if (!plan) return;
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { plan },
  });
}

async function downgradeByCustomer(customerId: string) {
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { plan: "free" },
  });
}
