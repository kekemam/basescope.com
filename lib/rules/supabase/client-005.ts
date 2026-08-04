import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

const RULE_ID = "CLIENT-005";
const DOCS_URL = docsUrlFor(RULE_ID);

const REQUIRED_HEADERS: Array<{ header: string; label: string }> = [
  { header: "content-security-policy", label: "Content-Security-Policy" },
  { header: "strict-transport-security", label: "Strict-Transport-Security" },
  { header: "x-frame-options", label: "X-Frame-Options" },
];

export const client005: Rule = {
  id: RULE_ID,
  title: "Cabeçalhos de segurança em falta",
  severity: "low",
  category: "client-exposure",
  async check(ctx: ScanContext): Promise<Finding[]> {
    if (!ctx.verifiedDomain) return [];

    const res = await fetch(`https://${ctx.verifiedDomain}/`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (!res) return [];

    const missing = REQUIRED_HEADERS.filter(({ header }) => !res.headers.has(header));
    if (missing.length === 0) return [];

    return [
      {
        ruleId: RULE_ID,
        severity: "low",
        resourceType: "client",
        resourceName: ctx.verifiedDomain,
        title: "Cabeçalhos de segurança em falta",
        description: `Faltam: ${missing.map((m) => m.label).join(", ")}.`,
        evidence: { missing_headers: missing.map((m) => m.label) },
        remediationSql: null,
        remediationSteps: [
          "Adiciona os cabeçalhos em falta (ex.: via `headers()` no next.config.ts ou middleware).",
          "CSP restritiva sem `unsafe-eval`, HSTS com `max-age` alto, X-Frame-Options DENY ou SAMEORIGIN.",
        ],
        docsUrl: DOCS_URL,
      },
    ];
  },
};
