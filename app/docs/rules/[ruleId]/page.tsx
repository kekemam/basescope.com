import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsShell } from "@/components/docs-shell";
import { CodeBlock } from "@/components/ui/code-block";
import { RULE_DOCS, getRuleDoc } from "@/lib/docs/rules-content";

const SEVERITY_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const SEVERITY_VAR: Record<string, string> = {
  critical: "var(--crit)",
  high: "var(--high)",
  medium: "var(--med)",
  low: "var(--low)",
};

export function generateStaticParams() {
  return RULE_DOCS.map((rule) => ({ ruleId: rule.id.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ ruleId: string }> }): Promise<Metadata> {
  const { ruleId } = await params;
  const rule = getRuleDoc(ruleId);
  if (!rule) return {};

  return {
    title: `${rule.id}: ${rule.title} — Basescope`,
    description: rule.summary,
  };
}

export default async function RuleDocPage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  const rule = getRuleDoc(ruleId);
  if (!rule) notFound();

  return (
    <DocsShell>
      <article className="px-6 py-12 max-w-2xl mx-auto">
        <Link href="/docs" className="font-data text-body-sm text-fg-subtle hover:text-fg-muted">
          ← Rule catalog
        </Link>

        <div className="flex items-center gap-3 mt-4 mb-2">
          <span className="font-data text-body-sm text-fg-subtle">{rule.id}</span>
          <span className="font-data text-body-sm" style={{ color: SEVERITY_VAR[rule.severity] }}>
            {SEVERITY_LABEL[rule.severity]}
          </span>
          <span className="font-data text-body-sm text-fg-subtle">· {rule.category}</span>
        </div>
        <h1 className="font-display text-display-xl text-fg mb-6">{rule.title}</h1>

        <p className="font-prosa text-body text-fg border border-border-str bg-surface rounded-md p-4 mb-8">
          {rule.summary}
        </p>

        <div className="flex flex-col gap-8 font-prosa text-body text-fg-muted">
          <div>
            <h2 className="font-data text-label uppercase tracking-[0.08em] text-fg mb-2">Why it matters</h2>
            <p>{rule.explanation}</p>
          </div>

          <div>
            <h2 className="font-data text-label uppercase tracking-[0.08em] text-fg mb-2">Vulnerable</h2>
            <CodeBlock code={rule.vulnerable} />
          </div>

          <div>
            <h2 className="font-data text-label uppercase tracking-[0.08em] text-fg mb-2">Fixed</h2>
            <CodeBlock code={rule.fixed} />
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="font-prosa text-body-sm text-fg-muted mb-3">
            Basescope checks for {rule.id} and 30 other Supabase misconfigurations automatically, on your real
            project.
          </p>
          <Link href="/signup">
            <button className="inline-flex items-center justify-center rounded-sm font-data text-data transition-colors duration-[120ms] ease-out bg-accent text-bg hover:bg-accent/90 h-[34px] px-3">
              Scan your project free →
            </button>
          </Link>
        </div>
      </article>
    </DocsShell>
  );
}
