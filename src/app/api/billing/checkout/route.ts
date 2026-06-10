import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { plan } = await req.json();
    const priceId =
      plan === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : plan === "crew"
          ? process.env.STRIPE_CREW_PRICE_ID
          : null;
    if (!priceId) return jsonError("Unknown plan");

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: user.email,
        name: user.businessName ?? user.name ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, plan },
      success_url: `${appUrl}/dashboard?upgraded=1`,
      cancel_url: `${appUrl}/dashboard`,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    return handleApiError(err);
  }
}
