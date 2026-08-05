import "server-only";
import Stripe from "stripe";

export function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não está definida");
  return new Stripe(key);
}

export type PlanId = "solo" | "pro" | "agency";

/** IDs de preço criados no dashboard Stripe — nunca inventados aqui, só lidos do ambiente. */
export function priceIdForPlan(plan: PlanId): string {
  const envKey = `STRIPE_PRICE_${plan.toUpperCase()}` as const;
  const priceId = process.env[envKey];
  if (!priceId) throw new Error(`${envKey} não está definida`);
  return priceId;
}
