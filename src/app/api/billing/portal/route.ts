import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireUser();
    if (!user.stripeCustomerId) {
      return jsonError("No billing account yet — upgrade to a paid plan first");
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/settings/branding`,
    });
    return NextResponse.json({ portalUrl: session.url });
  } catch (err) {
    return handleApiError(err);
  }
}
