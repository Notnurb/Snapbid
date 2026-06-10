import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion });
  }
  return _stripe;
}
