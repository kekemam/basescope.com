import { EmptyState } from "@/components/ui/empty-state";

export default function FaturacaoPage() {
  return (
    <div className="px-6 py-6">
      <h1 className="font-display text-display-l text-fg mb-6">Faturação</h1>
      <EmptyState
        title="Faturação ainda não está disponível."
        description="Stripe (Checkout, Customer Portal, planos) é Fase 3 do PROJECT_SPEC — por agora todos os projetos correm no plano Free."
      />
    </div>
  );
}
