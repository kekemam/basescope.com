"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient, priceIdForPlan, type PlanId } from "@/lib/stripe/client";

async function getCurrentOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1).single();
  if (!membership) throw new Error("Sem organização associada.");
  return membership.org_id as string;
}

export async function startCheckout(plan: PlanId) {
  const orgId = await getCurrentOrg();
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("stripe_customer_id").eq("id", orgId).single();

  const stripe = createStripeClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: orgId,
    customer: org?.stripe_customer_id ?? undefined,
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    success_url: `${siteUrl}/app/org/faturacao?checkout=success`,
    cancel_url: `${siteUrl}/app/org/faturacao?checkout=cancelled`,
    automatic_tax: { enabled: true },
  });

  if (!session.url) throw new Error("Stripe não devolveu um URL de checkout.");
  redirect(session.url);
}

export async function openBillingPortal() {
  const orgId = await getCurrentOrg();
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("stripe_customer_id").eq("id", orgId).single();

  if (!org?.stripe_customer_id) {
    throw new Error("Ainda não tens um plano pago — não há nada para gerir no Customer Portal.");
  }

  const stripe = createStripeClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${siteUrl}/app/org/faturacao`,
  });

  redirect(session.url);
}
