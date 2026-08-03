import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { fetchBundlesForDomain } from "./_client-shared";

const RULE_ID = "CLIENT-001";
const DOCS_URL = docsUrlFor(RULE_ID);

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const SB_SECRET_PATTERN = /sb_secret_[A-Za-z0-9_-]{20,}/g;

function decodeJwtRole(token: string): string | null {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

const REMEDIATION_STEPS = [
  "Roda imediatamente a service_role key no dashboard Supabase (Settings → API → Reset).",
  "Remove a variável do código cliente — em Next.js, nunca prefixa `service_role` com NEXT_PUBLIC_.",
  "Move as operações que precisavam dela para Route Handlers, Server Actions ou Edge Functions.",
  "Redeploy.",
  "Assume que a chave está comprometida: revê logs de acesso e verifica alterações inesperadas em dados.",
  "Volta a correr o scan para confirmar.",
];

export const client001: Rule = {
  id: RULE_ID,
  title: "Chave service_role exposta no cliente",
  severity: "critical",
  category: "client-exposure",
  async check(ctx: ScanContext): Promise<Finding[]> {
    if (!ctx.verifiedDomain) return [];

    const bundles = await fetchBundlesForDomain(ctx.verifiedDomain);
    const findings: Finding[] = [];

    for (const bundle of bundles) {
      for (const match of bundle.content.matchAll(JWT_PATTERN)) {
        const token = match[0];
        const role = decodeJwtRole(token);
        if (role !== "service_role") continue;

        findings.push({
          ruleId: RULE_ID,
          severity: "critical",
          resourceType: "client",
          resourceName: bundle.path,
          title: "Chave service_role (formato JWT legacy) exposta no cliente",
          description: `Encontrada uma chave service_role dentro de ${bundle.path}, acessível a qualquer visitante do site.`,
          evidence: { file: bundle.path, offset: match.index ?? null, prefix: token.slice(0, 8), role },
          remediationSql: null,
          remediationSteps: REMEDIATION_STEPS,
          docsUrl: DOCS_URL,
        });
      }

      for (const match of bundle.content.matchAll(SB_SECRET_PATTERN)) {
        const token = match[0];
        findings.push({
          ruleId: RULE_ID,
          severity: "critical",
          resourceType: "client",
          resourceName: bundle.path,
          title: "Chave service_role (formato novo sb_secret_) exposta no cliente",
          description: `Encontrada uma API key secreta (sb_secret_...) dentro de ${bundle.path}.`,
          evidence: { file: bundle.path, offset: match.index ?? null, prefix: token.slice(0, 8), role: "service_role" },
          remediationSql: null,
          remediationSteps: REMEDIATION_STEPS,
          docsUrl: DOCS_URL,
        });
      }
    }

    return findings;
  },
};
