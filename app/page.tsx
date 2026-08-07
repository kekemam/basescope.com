import Link from "next/link";
import { Search, ShieldCheck, Wrench, BellRing, FileDown, Radar, Database, Zap } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { SeverityBar } from "@/components/severity-bar";
import { LegalFooter } from "@/components/legal-footer";
import { getPublicStats, getSelfScanScore } from "@/lib/data/public-stats";

// Sem isto, o Next tentava pré-renderizar a página como estática no build
// e congelava a contagem de projetos analisados no valor de build time.
export const dynamic = "force-dynamic";

const PLANS = [
  { name: "Free", price: "0€", projects: "1", scans: "1/mês", extra: "3 achados visíveis" },
  { name: "Solo", price: "29€/mês", projects: "3", scans: "semanal", extra: "Todos os achados, SQL, email" },
  { name: "Pro", price: "79€/mês", projects: "10", scans: "diário", extra: "Slack/Discord, PDF, API, histórico" },
  { name: "Agency", price: "249€/mês", projects: "50", scans: "diário", extra: "White-label, sub-contas, prioridade" },
];

const QUICK_FACTS = [
  { icon: Radar, title: "Deteção contínua", detail: "Scans agendados — diário no Pro" },
  { icon: Database, title: "31 regras reais", detail: "Catálogo Postgres, não heurísticas" },
  { icon: Zap, title: "Correção pronta", detail: "SQL para colar, sem adivinhar" },
];

const FEATURES = [
  {
    icon: Search,
    title: "Deteção real",
    detail: "Lemos pg_policies, pg_class e pg_proc diretamente — não heurísticas de IA em cima do teu código.",
  },
  {
    icon: ShieldCheck,
    title: "Priorização por severidade",
    detail: "Score determinístico e publicado: 100 − (crítico×20 + alto×8 + médio×3 + baixo×1).",
  },
  {
    icon: Wrench,
    title: "Correção pronta a colar",
    detail: "Cada achado vem com o SQL exato para o SQL Editor, mais um script combinado para todos.",
  },
  {
    icon: BellRing,
    title: "Scans agendados + alertas",
    detail: "Diário no Pro, semanal no Solo. Avisamos por email/Slack/Discord só quando há achado novo.",
  },
  {
    icon: FileDown,
    title: "Relatório exportável",
    detail: "PDF para mostrares a um cliente ou investidor, ou JSON para integrares onde precisares.",
  },
];

const STEPS = [
  { n: "1", title: "Liga o teu Supabase", detail: "OAuth (prova propriedade automaticamente) ou cola a connection string + anon key." },
  { n: "2", title: "Corremos 31 regras reais", detail: "RLS, storage, funções, auth, edge functions — contra o catálogo do teu Postgres, nunca os teus dados." },
  { n: "3", title: "Recebe o SQL de correção", detail: "Cada achado explica o risco e dá o SQL pronto a colar. Corre de novo para confirmar." },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Isto é seguro? Estão a pedir-me credenciais da minha base de dados.",
    a: "Sim, e é por isso que a verificação de propriedade é obrigatória antes de qualquer scan. As credenciais são encriptadas com AES-256-GCM, nunca aparecem em logs, e podes revogá-las com um clique em Definições → Credenciais.",
  },
  {
    q: "Porque precisam de uma connection string, não só da anon key?",
    a: "Para ler o catálogo do Postgres (pg_policies, pg_class) — informação sobre a tua base de dados, não os teus dados. A anon key sozinha só nos deixa testar o que um visitante anónimo consegue ver, não auditar as políticas em si.",
  },
  {
    q: "E se eu não perceber SQL?",
    a: "Cada achado vem com o SQL pronto a colar no SQL Editor do Supabase, uma explicação em português simples do que estava exposto, e o botão \"Copiar todo o SQL de correção\" junta tudo num único script.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, sem período de fidelização. Cancelas no Customer Portal do Stripe e os teus dados são apagados 90 dias depois — as credenciais, imediatamente.",
  },
  {
    q: "Vocês leem os meus dados durante o scan?",
    a: "Não. O teste de acesso anónimo faz um pedido HEAD, que nunca devolve conteúdo — só contamos linhas visíveis. Nunca guardamos valores de colunas, só nomes de tabelas e políticas.",
  },
  {
    q: "Vão dar falsos positivos que me façam perder tempo?",
    a: "As 12 regras críticas são testadas contra fixtures com schema vulnerável e corrigido antes de cada release — zero falsos positivos é critério de lançamento, não um objetivo vago.",
  },
  {
    q: "Podem varrer o Supabase de outra pessoa se eu souber o URL?",
    a: "Não — está explicitamente proibido no desenho do produto. Só analisamos projetos com propriedade verificada (ficheiro well-known ou OAuth). Sem esse registo, o motor recusa-se a correr.",
  },
  {
    q: "O que acontece à minha service_role key se eu cancelar?",
    a: "É apagada imediatamente, não só marcada como inativa. Achados e histórico ficam retidos por 90 dias para exportares, depois também desaparecem.",
  },
];

function scoreBand(score: number): string {
  if (score >= 80) return "Bom";
  if (score >= 50) return "A melhorar";
  return "Crítico";
}

export default async function LandingPage() {
  const stats = await getPublicStats();
  const selfScan = await getSelfScanScore();

  return (
    <div className="landing-light flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 font-prosa text-body-sm text-fg-muted">
          <a href="#produto" className="hover:text-fg">Produto</a>
          <a href="#recursos" className="hover:text-fg">Recursos</a>
          <a href="#como-funciona" className="hover:text-fg">Como funciona</a>
          <a href="#precos" className="hover:text-fg">Preços</a>
          <Link href="/docs" className="hover:text-fg">Docs</Link>
        </nav>
        <Link href="/login" className="font-prosa text-body-sm text-fg-muted hover:text-fg">
          Login
        </Link>
      </header>

      <main className="flex-1">
        <section id="produto" className="px-6 pt-16 pb-14 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
            <div>
              <span className="inline-block rounded-full border border-border-str px-3 py-1 font-data text-[11px] uppercase tracking-[0.1em] text-fg-muted mb-6">
                Copiloto de segurança para apps feitas com IA
              </span>
              <h1 className="font-display text-display-xl leading-[1.1] mb-4">
                <span className="text-fg">Descobre se a tua app</span>
                <br />
                <span className="text-fg-subtle">está a expor a base de dados.</span>
              </h1>
              <p className="font-prosa text-body text-fg-muted max-w-md mb-8">
                Basescope liga-se ao teu Supabase, testa 31 configurações de segurança reais — RLS, storage, funções,
                auth — e devolve o SQL exato para corrigir cada uma.
              </p>
              <Link href="/signup">
                <Button variant="primary" size="md" className="px-6 mb-10">
                  Scan grátis →
                </Button>
              </Link>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {QUICK_FACTS.map((f) => (
                  <div key={f.title} className="flex flex-col gap-1.5">
                    <f.icon size={18} strokeWidth={1.75} className="text-fg" />
                    <span className="font-prosa text-body-sm font-medium text-fg">{f.title}</span>
                    <span className="font-prosa text-body-sm text-fg-muted">{f.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {selfScan && (
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="font-data text-[11px] uppercase tracking-[0.1em] text-fg-subtle mb-4">
                  Score de segurança
                </p>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <span className="font-display text-display-xl text-fg">{selfScan.score}</span>
                    <span className="font-prosa text-body text-fg-subtle">/100</span>
                  </div>
                  <div className="text-right">
                    <p className="font-data text-[11px] uppercase tracking-[0.1em] text-fg-subtle">Nível</p>
                    <p className="font-display text-display-l text-fg">{scoreBand(selfScan.score)}</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-fg" style={{ width: `${selfScan.score}%` }} />
                </div>
                {selfScan.deltaSincePrevious !== null && (
                  <p className="font-data text-body-sm text-fg-subtle">
                    {selfScan.deltaSincePrevious >= 0 ? "↑" : "↓"} {Math.abs(selfScan.deltaSincePrevious)} pontos desde o
                    último scan
                  </p>
                )}
                <p className="font-prosa text-body-sm text-fg-subtle mt-3 pt-3 border-t border-border">
                  O próprio Basescope, verificado todos os dias contra si mesmo — não é um exemplo.
                </p>
              </div>
            )}
          </div>
        </section>

        <section id="recursos" className="px-6 py-16 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display text-display-l text-fg mb-10 text-center">O que o Basescope faz</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex flex-col gap-2">
                  <f.icon size={20} strokeWidth={1.75} className="text-fg mb-1" />
                  <span className="font-prosa text-body-sm font-medium text-fg">{f.title}</span>
                  <span className="font-prosa text-body-sm text-fg-muted">{f.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="px-6 py-16 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-display-l text-fg mb-10 text-center">Como funciona</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STEPS.map((s) => (
                <div key={s.n} className="flex flex-col gap-2">
                  <span className="font-display text-display-l text-fg-subtle">{s.n}</span>
                  <span className="font-prosa text-body font-medium text-fg">{s.title}</span>
                  <span className="font-prosa text-body-sm text-fg-muted">{s.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-16 max-w-2xl mx-auto">
          <div className="border border-border-str rounded-lg bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 h-11">
              <span className="font-data text-body-sm text-fg-subtle">Exemplo de relatório</span>
              <span className="font-data text-body-sm text-fg-subtle">score 42</span>
            </div>
            <div className="flex flex-col">
              {[
                { sev: "critical" as const, rule: "ANON-001", resource: "public.profiles" },
                { sev: "critical" as const, rule: "RLS-003", resource: "policy orders_all" },
                { sev: "high" as const, rule: "FN-001", resource: "promote_user(uuid)" },
              ].map((row) => (
                <div key={row.rule} className="flex items-center gap-4 px-4 h-11 border-b border-border last:border-0">
                  <SeverityBar status={row.sev} showLabel={false} />
                  <span className="font-data text-data text-fg w-24">{row.rule}</span>
                  <span className="font-data text-data text-fg-muted truncate">{row.resource}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="font-data text-body-sm text-fg-subtle text-center mt-2">
            Ilustrativo — ainda não temos um screenshot real para mostrar aqui.
          </p>
        </section>

        <section className="px-6 py-16 border-t border-border">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-display-l text-fg mb-6">O que NÃO fazemos</h2>
            <ul className="flex flex-col gap-3 font-prosa text-body text-fg-muted text-left">
              <li>— Não lemos o conteúdo das tuas tabelas. O teste de acesso anónimo usa HEAD, nunca GET.</li>
              <li>— Não guardamos linhas de dados. A evidência é sempre nomes e contagens, nunca valores.</li>
              <li>— Não varremos projetos que não sejam teus. Sem propriedade verificada, o scan não corre.</li>
              <li>— Não escondemos o número total de achados atrás do paywall — só o detalhe.</li>
            </ul>
            <p className="font-data text-body-sm text-fg-subtle mt-8">
              {stats.projectsAnalyzed > 0
                ? `${stats.projectsAnalyzed} projetos analisados · ${stats.percentWithCritical}% tinham pelo menos um achado crítico`
                : "Ainda não temos dados agregados — sê um dos primeiros a correr um scan."}
            </p>
          </div>
        </section>

        <section id="precos" className="px-6 py-16 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-display-l text-fg mb-8 text-center">Preços</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PLANS.map((plan) => (
                <div key={plan.name} className="border border-border rounded-lg bg-surface p-5 flex flex-col gap-2">
                  <span className="font-prosa text-body-sm font-medium text-fg">{plan.name}</span>
                  <span className="font-display text-display-l text-fg">{plan.price}</span>
                  <span className="font-data text-body-sm text-fg-muted">{plan.projects} projeto(s) · {plan.scans}</span>
                  <span className="font-prosa text-body-sm text-fg-muted">{plan.extra}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16 border-t border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display text-display-l text-fg mb-8 text-center">Perguntas frequentes</h2>
            <dl className="flex flex-col gap-6">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="font-prosa text-body font-medium text-fg mb-1">{item.q}</dt>
                  <dd className="font-prosa text-body text-fg-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
