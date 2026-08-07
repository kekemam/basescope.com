import Link from "next/link";
import { getDashboardData, type CategoryColor } from "@/lib/data/dashboard";
import { ScoreGauge } from "@/components/dashboard/score-gauge";
import { DashboardScanButton } from "@/components/dashboard/scan-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const SEVERITY_LABEL: Record<string, string> = { critical: "Crítico", high: "Elevado", medium: "Médio", low: "Baixo" };
const SEVERITY_VAR: Record<string, string> = {
  critical: "var(--crit)",
  high: "var(--high)",
  medium: "var(--med)",
  low: "var(--low)",
};
const CATEGORY_VAR: Record<CategoryColor, string> = {
  crit: "var(--crit)",
  high: "var(--high)",
  med: "var(--med)",
  low: "var(--low)",
  subtle: "var(--fg-subtle)",
};
const BADGE_TONE_CLASS: Record<string, string> = {
  ok: "text-ok border-ok/40 bg-ok/10",
  crit: "text-crit border-crit/40 bg-crit/10",
  muted: "text-fg-subtle border-border-str bg-surface-2",
};
const BANDS = [
  { label: "Crítico", range: "0–20", color: "var(--crit)" },
  { label: "Elevado", range: "21–40", color: "var(--high)" },
  { label: "Médio", range: "41–60", color: "var(--med)" },
  { label: "Baixo", range: "61–80", color: "var(--low)" },
  { label: "OK", range: "81–100", color: "var(--ok)" },
];

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

function Card({ title, info, children }: { title: string; info?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-1.5">
        <p className="font-prosa text-body-sm font-medium text-fg-subtle">{title}</p>
        {info && <span className="text-fg-subtle" title={info}>ⓘ</span>}
      </div>
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " UTC";
}

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDashboardData(id);

  if (!data.hasScan) {
    return (
      <EmptyState
        title="Ainda não correu nenhum scan."
        description="Executa o primeiro scan para veres o score de segurança, achados e atividade deste projeto aqui."
        action={<DashboardScanButton projectId={id} />}
      />
    );
  }

  const { counts, score, totalOpen, okCount, exposureConfirmed, lastScan, recentFindings, categories, activity } = data;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display-l text-fg">Dashboard</h1>
          <p className="font-prosa text-body text-fg-muted">Visão geral da postura de segurança do projeto.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/projects/${id}/report/pdf`}>
            <Button variant="ghost">↓ Exportar PDF</Button>
          </a>
          <a href={`/api/projects/${id}/report/json`}>
            <Button variant="ghost">↓ JSON</Button>
          </a>
          <DashboardScanButton projectId={id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card title="Score de segurança">
          <div className="flex items-center gap-4">
            <ScoreGauge score={score} />
            <ul className="flex flex-col gap-1.5">
              {BANDS.map((b) => (
                <li key={b.label} className="flex items-center gap-2 font-data text-body-sm text-fg-muted">
                  <Dot color={b.color} />
                  {b.label}
                  <span className="text-fg-subtle">{b.range}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Achados">
          <span className="font-display text-display-xl leading-none text-fg">{totalOpen}</span>
          <span className="mb-3 mt-1 font-data text-body-sm text-fg-subtle">Total em aberto</span>
          <ul className="flex flex-col gap-1.5">
            {(["critical", "high", "medium", "low"] as const).map((sev) => (
              <li key={sev} className="flex items-center justify-between gap-2 font-data text-body-sm text-fg-muted">
                <span className="flex items-center gap-2">
                  <Dot color={SEVERITY_VAR[sev]!} />
                  {SEVERITY_LABEL[sev]}
                </span>
                <span className="text-fg">{counts[sev]}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 font-data text-body-sm text-fg-muted">
              <span className="flex items-center gap-2">
                <Dot color="var(--ok)" />
                OK
              </span>
              <span className="text-fg">{okCount}</span>
            </li>
          </ul>
        </Card>

        <Card title="Exposição confirmada">
          <p className="font-display text-display-l" style={{ color: exposureConfirmed ? "var(--crit)" : "var(--ok)" }}>
            {exposureConfirmed ? "Sim" : "Não"}
          </p>
          <p className="mb-3 mt-1 font-prosa text-body-sm text-fg-muted">
            {exposureConfirmed
              ? "Qualquer pessoa na internet pode aceder a dados sensíveis (ANON-001)."
              : "Nenhuma leitura anónima de dados sensíveis foi confirmada no último scan."}
          </p>
          <Link href={`/app/p/${id}/achados`}>
            <Button variant="ghost" size="sm">Ver detalhes →</Button>
          </Link>
        </Card>

        <Card title="Último scan">
          {lastScan?.finishedAt ? (
            <>
              <p className="font-data text-body text-fg">{formatDate(lastScan.finishedAt)}</p>
              <p className="mb-3 mt-1 font-data text-body-sm text-fg-subtle">
                Duração: {lastScan.durationLabel ?? "—"}
                <br />
                Por: {lastScan.trigger}
              </p>
              <span className="inline-flex w-fit items-center gap-1 rounded-sm border border-ok/40 bg-ok/10 px-1.5 py-0.5 font-data text-body-sm text-ok">
                ✓ Concluído
              </span>
            </>
          ) : (
            <p className="font-data text-body-sm text-fg-subtle">Scan ainda a correr.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-prosa text-body font-medium text-fg">Achados recentes</p>
            <Link href={`/app/p/${id}/achados`} className="font-data text-body-sm text-accent hover:underline">
              Ver todos
            </Link>
          </div>
          {recentFindings.length === 0 ? (
            <p className="px-4 py-6 font-prosa text-body-sm text-fg-muted">Sem achados em aberto — bom trabalho.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-data text-label uppercase text-fg-subtle">Severidade</th>
                    <th className="px-4 py-2 text-left font-data text-label uppercase text-fg-subtle">Regra</th>
                    <th className="px-4 py-2 text-left font-data text-label uppercase text-fg-subtle">Recurso</th>
                    <th className="px-4 py-2 text-left font-data text-label uppercase text-fg-subtle">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFindings.map((f) => (
                    <tr key={f.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2 font-data text-body-sm text-fg-muted">
                          <Dot color={SEVERITY_VAR[f.severity]!} />
                          {SEVERITY_LABEL[f.severity]}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-data text-body-sm text-fg">{f.ruleId}</td>
                      <td className="px-4 py-2 font-data text-body-sm text-fg-muted">{f.resourceName}</td>
                      <td className="px-4 py-2 font-prosa text-body-sm text-fg-muted">{f.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="mb-3 font-prosa text-body font-medium text-fg">Principais categorias</p>
            {categories.length === 0 ? (
              <p className="font-prosa text-body-sm text-fg-muted">Sem achados para agrupar.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {categories.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-2 font-data text-body-sm text-fg-muted">
                    <span className="flex items-center gap-2">
                      <Dot color={CATEGORY_VAR[c.color]} />
                      {c.label}
                    </span>
                    <span className="text-fg">{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/app/p/${id}/achados`} className="mt-3 inline-block font-data text-body-sm text-accent hover:underline">
              Ver achados →
            </Link>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-prosa text-body font-medium text-fg">Atividade recente</p>
              <Link href={`/app/p/${id}/historico`} className="font-data text-body-sm text-accent hover:underline">
                Ver todo o histórico
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="font-prosa text-body-sm text-fg-muted">Sem atividade ainda.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-data text-body-sm text-fg">{a.title}</p>
                      {a.subtitle && <p className="font-data text-body-sm text-fg-subtle">{a.subtitle}</p>}
                      <p className="font-data text-body-sm text-fg-subtle">{formatDate(a.timestamp)}</p>
                    </div>
                    <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-data text-body-sm ${BADGE_TONE_CLASS[a.badgeTone]}`}>
                      {a.badge}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
