import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createStripeClient } from "@/lib/stripe/client";
import { planFromPriceId } from "@/lib/stripe/plan-from-price";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentFailedEmail } from "@/lib/email/resend";

/**
 * PROJECT_SPEC § 8: verificação de assinatura HMAC obrigatória, idempotência
 * via `stripe_events.event_id` UNIQUE (testa-se reenviando o mesmo evento
 * 3 vezes — critério de aceitação da secção 12). O INSERT nessa tabela é o
 * próprio mecanismo de idempotência: se já existir, a constraint UNIQUE
 * falha e sabemos que já processámos este evento.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "webhook não configurado" }, { status: 500 });
  }

  const rawBody = await request.text();
  const stripe = createStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `assinatura inválida: ${err instanceof Error ? err.message : err}` }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: insertError } = await admin
    .from("stripe_events")
    .insert({ event_id: event.id, event_type: event.type });

  if (insertError) {
    // unique_violation (23505) = já processámos este evento — idempotência,
    // não erro. Qualquer outro código de erro é real e deve ser reportado.
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.client_reference_id;
      if (orgId && session.customer) {
        await admin
          .from("organizations")
          .update({ stripe_customer_id: String(session.customer) })
          .eq("id", orgId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? planFromPriceId(priceId) : null;
      if (plan) {
        await admin
          .from("organizations")
          .update({ plan })
          .eq("stripe_customer_id", String(subscription.customer));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await admin
        .from("organizations")
        .update({ plan: "free" })
        .eq("stripe_customer_id", String(subscription.customer));
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer ? String(invoice.customer) : null;
      if (customerId) {
        const { data: org } = await admin
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (org) {
          const { data: owner } = await admin
            .from("memberships")
            .select("user_id")
            .eq("org_id", org.id)
            .eq("role", "owner")
            .limit(1)
            .maybeSingle();

          if (owner) {
            const { data: userData } = await admin.auth.admin.getUserById(owner.user_id);
            const email = userData?.user?.email;
            if (email) {
              const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
              await sendPaymentFailedEmail(email, `${siteUrl}/app/org/faturacao`);
            }
          }
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
