import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/components/docs-shell";
import { RULE_DOCS } from "@/lib/docs/rules-content";

export const metadata: Metadata = {
  title: "Supabase security rule catalog — Basescope",
  description:
    "31 documented Supabase security misconfigurations — RLS, storage, auth, edge functions, client exposure — each with a vulnerable example and the exact SQL fix.",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;
const SEVERITY_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

export default function DocsIndexPage() {
  const byCategory = new Map<string, typeof RULE_DOCS>();
  for (const rule of RULE_DOCS) {
    if (!byCategory.has(rule.category)) byCategory.set(rule.category, []);
    byCategory.get(rule.category)!.push(rule);
  }

  return (
    <DocsShell>
      <section className="px-6 py-16 max-w-3xl mx-auto text-center flex flex-col items-center gap-4">
        <h1 className="font-display text-display-xl text-fg">Supabase security rule catalog</h1>
        <p className="font-prosa text-body text-fg-muted max-w-xl">
          {RULE_DOCS.length} documented misconfigurations that Basescope checks for — each page has a vulnerable
          example, the exact SQL fix, and why it matters.
        </p>
      </section>

      <section className="px-6 pb-20 max-w-3xl mx-auto flex flex-col gap-10">
        {[...byCategory.entries()].map(([category, rules]) => (
          <div key={category}>
            <h2 className="font-data text-label uppercase tracking-[0.08em] text-fg-subtle mb-3">{category}</h2>
            <div className="border border-border rounded-md bg-surface overflow-hidden">
              {[...rules]
                .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
                .map((rule) => (
                  <Link
                    key={rule.id}
                    href={`/docs/rules/${rule.id.toLowerCase()}`}
                    className="flex items-center gap-4 px-4 h-12 border-b border-border last:border-0 hover:bg-surface-2"
                  >
                    <span className="font-data text-data text-fg-subtle w-20 shrink-0">{rule.id}</span>
                    <span className="font-prosa text-body-sm text-fg flex-1 truncate">{rule.title}</span>
                    <span
                      className="font-data text-body-sm shrink-0"
                      style={{
                        color:
                          rule.severity === "critical"
                            ? "var(--crit)"
                            : rule.severity === "high"
                              ? "var(--high)"
                              : rule.severity === "medium"
                                ? "var(--med)"
                                : "var(--low)",
                      }}
                    >
                      {SEVERITY_LABEL[rule.severity]}
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </section>
    </DocsShell>
  );
}
