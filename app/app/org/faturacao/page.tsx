import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { startCheckout, openBillingPortal } from "./actions";
import type { PlanId } from "@/lib/stripe/client";

const PLANS: Array<{ id: PlanId; name: string; price: string; projects: number; scans: string }> = [
  { id: "solo", name: "Solo", price: "29€/mês", projects: 3, scans: "semanal" },
  { id: "pro", name: "Pro", price: "79€/mês", projects: 10, scans: "diário" },
  { id: "agency", name: "Agency", price: "249€/mês", projects: 50, scans: "diário" },
];

export default async function FaturacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("plan, scans_used_this_period, period_ends_at, stripe_customer_id")
    .limit(1)
    .single();

  const { count: projectCount } = await supabase.from("projects").select("id", { count: "exact", head: true });

  return (
    <div className="px-6 py-6 max-w-3xl">
      <h1 className="font-display text-display-l text-fg mb-1">Faturação</h1>
      <p className="font-data text-body-sm text-fg-subtle mb-6">
        Plano atual: <span className="text-fg">{org?.plan ?? "free"}</span> · {projectCount ?? 0} projeto(s) ·{" "}
        {org?.scans_used_this_period ?? 0} scan(s) usados este período
      </p>

      {checkout === "success" && (
        <p className="font-data text-data text-ok mb-6">Subscrição atualizada — pode demorar alguns segundos a refletir.</p>
      )}
      {checkout === "cancelled" && <p className="font-data text-data text-fg-muted mb-6">Checkout cancelado.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan) => (
          <div key={plan.id} className="border border-border rounded-md bg-surface p-4 flex flex-col gap-2">
            <span className="font-data text-data text-fg">{plan.name}</span>
            <span className="font-display text-display-l text-fg">{plan.price}</span>
            <span className="font-data text-body-sm text-fg-muted">
              {plan.projects} projetos · {plan.scans}
            </span>
            <form action={startCheckout.bind(null, plan.id)}>
              <Button variant={org?.plan === plan.id ? "ghost" : "primary"} disabled={org?.plan === plan.id} className="w-full mt-2">
                {org?.plan === plan.id ? "Plano atual" : "Mudar para " + plan.name}
              </Button>
            </form>
          </div>
        ))}
      </div>

      {org?.stripe_customer_id && (
        <form action={openBillingPortal}>
          <Button variant="ghost">Gerir subscrição (Customer Portal)</Button>
        </form>
      )}
    </div>
  );
}
