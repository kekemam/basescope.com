import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { SeverityBar } from "@/components/severity-bar";
import { LegalFooter } from "@/components/legal-footer";
import { getPublicStats } from "@/lib/data/public-stats";

// Sem isto, o Next tentava pré-renderizar a página como estática no build
// e congelava a contagem de projetos analisados no valor de build time.
export const dynamic = "force-dynamic";

const PLANS = [
  { name: "Free", price: "0€", projects: "1", scans: "1/mês", extra: "3 achados visíveis" },
  { name: "Solo", price: "29€/mês", projects: "3", scans: "semanal", extra: "Todos os achados, SQL, email" },
  { name: "Pro", price: "79€/mês", projects: "10", scans: "diário", extra: "Slack/Discord, PDF, API, histórico" },
  { name: "Agency", price: "249€/mês", projects: "50", scans: "diário", extra: "White-label, sub-contas, prioridade" },
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

export default async function LandingPage() {
  const stats = await getPublicStats();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Logo />
        <nav className="flex items-center gap-4 font-data text-data">
          <Link href="/login" className="text-fg-muted hover:text-fg">
            Entrar
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">
              Scan grátis
            </Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="px-6 py-20 max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <h1 className="font-display text-display-xl text-fg">
            A tua app feita com IA está a expor a base de dados?
          </h1>
          <p className="font-prosa text-body text-fg-muted max-w-xl">
            Liga o teu Supabase e descobre em 90 segundos. Recebe o SQL para corrigir.
          </p>
          <Link href="/signup">
            <Button variant="primary" size="md" className="px-6">
              Scan grátis →
            </Button>
          </Link>

          <p className="font-data text-body-sm text-fg-subtle">
            {stats.projectsAnalyzed > 0
              ? `${stats.projectsAnalyzed} projetos analisados · ${stats.percentWithCritical}% tinham pelo menos um achado crítico`
              : "Ainda não temos dados agregados — sê um dos primeiros a correr um scan."}
          </p>
        </section>

        <section className="px-6 pb-20 max-w-2xl mx-auto">
          <div className="border border-border-str rounded-md bg-surface overflow-hidden">
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
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display text-display-l text-fg mb-6 text-center">O que NÃO fazemos</h2>
            <ul className="flex flex-col gap-3 font-prosa text-body text-fg-muted">
              <li>— Não lemos o conteúdo das tuas tabelas. O teste de acesso anónimo usa HEAD, nunca GET.</li>
              <li>— Não guardamos linhas de dados. A evidência é sempre nomes e contagens, nunca valores.</li>
              <li>— Não varremos projetos que não sejam teus. Sem propriedade verificada, o scan não corre.</li>
              <li>— Não escondemos o número total de achados atrás do paywall — só o detalhe.</li>
            </ul>
          </div>
        </section>

        <section className="px-6 py-16 border-t border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-display-l text-fg mb-8 text-center">Preços</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PLANS.map((plan) => (
                <div key={plan.name} className="border border-border rounded-md bg-surface p-4 flex flex-col gap-2">
                  <span className="font-data text-data text-fg">{plan.name}</span>
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
                  <dt className="font-data text-data text-fg mb-1">{item.q}</dt>
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
