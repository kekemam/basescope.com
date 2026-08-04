import { Badge } from "@/components/ui/badge";
import { listRuleStatusForProject } from "@/lib/data/rule-status";

const STATUS_ORDER = ["failing", "ignored", "unverified", "passing"];

export default async function RegrasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rules = await listRuleStatusForProject(id);

  const sorted = [...rules].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const passingCount = rules.filter((r) => r.status === "passing").length;

  return (
    <div className="px-6 py-6">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="font-display text-display-l text-fg">Regras</h1>
        <span className="font-data text-body-sm text-fg-muted">
          {passingCount}/{rules.length} a passar
        </span>
      </div>
      <p className="font-prosa text-body text-fg-muted mb-6">
        O que passou é tão importante como o que falhou — é o que justifica a assinatura quando não há achados.
      </p>

      <table className="w-full border-collapse font-data text-data">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 h-9 font-data text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Regra</th>
            <th className="text-left px-3 h-9 font-data text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Categoria</th>
            <th className="text-left px-3 h-9 font-data text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Estado</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((rule) => (
            <tr key={rule.id} className="h-9 border-b border-border hover:bg-surface-2">
              <td className="px-3 text-fg">
                <a href={`https://basescope.com/docs/rules/${rule.id.toLowerCase()}`} className="hover:text-accent">
                  {rule.id}
                </a>
                <span className="text-fg-muted ml-2">{rule.title}</span>
              </td>
              <td className="px-3 text-fg-muted">{rule.category}</td>
              <td className="px-3">
                <Badge status={rule.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
