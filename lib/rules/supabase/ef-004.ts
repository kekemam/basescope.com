import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface EdgeFunctionSummary {
  slug: string;
  verify_jwt: boolean;
  status: string;
  version: number;
}

const RULE_ID = "EF-004";
const DOCS_URL = docsUrlFor(RULE_ID);

function hasOpenCorsWithCredentials(body: string): boolean {
  const wildcardCors = /Access-Control-Allow-Origin[\s\S]{0,20}['"]\*['"]/.test(body);
  const readsAuthHeader = /headers\.get\(['"]Authorization['"]\)/.test(body);
  const allowsCredentials = /Access-Control-Allow-Credentials[\s\S]{0,20}['"]?true['"]?/i.test(body);
  return wildcardCors && (readsAuthHeader || allowsCredentials);
}

export const ef004: Rule = {
  id: RULE_ID,
  title: "CORS aberto numa função que aceita credenciais",
  severity: "medium",
  category: "edge-functions",
  async check(ctx: ScanContext): Promise<Finding[]> {
    if (!ctx.mgmtToken) return [];

    const listRes = await fetch(`https://api.supabase.com/v1/projects/${ctx.projectRef}/functions`, {
      headers: { Authorization: `Bearer ${ctx.mgmtToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!listRes.ok) return [];
    const functions = (await listRes.json()) as EdgeFunctionSummary[];

    const findings: Finding[] = [];

    for (const fn of functions) {
      const bodyRes = await fetch(
        `https://api.supabase.com/v1/projects/${ctx.projectRef}/functions/${fn.slug}/body`,
        { headers: { Authorization: `Bearer ${ctx.mgmtToken}` }, signal: AbortSignal.timeout(5000) },
      );
      if (!bodyRes.ok) continue;
      const body = await bodyRes.text();

      if (!hasOpenCorsWithCredentials(body)) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: "medium",
        resourceType: "edge_function",
        resourceName: fn.slug,
        title: "CORS aberto numa função que aceita credenciais",
        description: `A função "${fn.slug}" aceita pedidos de qualquer origem (CORS *) e lê credenciais (Authorization/cookies) — qualquer site pode fazer pedidos autenticados em nome do utilizador.`,
        evidence: { function: fn.slug },
        remediationSql: null,
        remediationSteps: ["Restringe Access-Control-Allow-Origin à lista de domínios que realmente precisam de chamar a função com credenciais."],
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
