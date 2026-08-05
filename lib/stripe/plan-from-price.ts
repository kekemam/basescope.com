import type { PlanId } from "./client";

const PLAN_IDS: PlanId[] = ["solo", "pro", "agency"];

/** Inverso de priceIdForPlan() — lido do ambiente, nunca hardcoded. */
export function planFromPriceId(priceId: string): PlanId | null {
  for (const plan of PLAN_IDS) {
    if (process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] === priceId) return plan;
  }
  return null;
}
