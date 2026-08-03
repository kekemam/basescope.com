import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface EdgeFunctionSummary {
  slug: string;
  verify_jwt: boolean;
  status: string;
  version: number;
}

const RULE_ID = "EF-001";
const DOCS_URL = docsUrlFor(RULE_ID);

const VERIFY_CALLER_TEMPLATE = `import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  // ... operação restrita a user.id
});`;

function usesServiceRole(body: string): boolean {
  return /SUPABASE_SERVICE_ROLE_KEY|service_role/.test(body);
}

function verifiesCaller(body: string): boolean {
  return (
    /getUser\s*\(/.test(body) ||
    /auth\.getUser/.test(body) ||
    /verify(Webhook|Signature)/i.test(body) ||
    /createHmac|timingSafeEqual|constructEvent/.test(body)
  );
}

function hasOpenCorsWithAuth(body: string): boolean {
  const wildcardCors = /Access-Control-Allow-Origin[\s\S]{0,20}['"]\*['"]/.test(body);
  const readsAuthHeader = /headers\.get\(['"]Authorization['"]\)/.test(body);
  return wildcardCors && readsAuthHeader;
}

export const ef001: Rule = {
  id: RULE_ID,
  title: "Edge Function com service_role sem verificar o chamador",
  severity: "critical",
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

      const usesSr = usesServiceRole(body);
      const verified = verifiesCaller(body);

      if (usesSr && fn.verify_jwt === false && !verified) {
        findings.push({
          ruleId: RULE_ID,
          severity: "critical",
          resourceType: "edge_function",
          resourceName: fn.slug,
          title: "Edge Function com service_role sem verificar o chamador",
          description: `A função "${fn.slug}" usa a service_role key, tem verify_jwt desativado, e não valida quem a está a chamar.`,
          evidence: { function: fn.slug, verify_jwt: fn.verify_jwt, uses_service_role: usesSr },
          remediationSql: null,
          remediationSteps: [
            "Valida o chamador com auth.getUser() antes de escalar para service_role.",
            "Para webhooks sem JWT, exige verificação HMAC da assinatura.",
          ],
          docsUrl: DOCS_URL,
        });
      } else if (usesSr && !verified) {
        findings.push({
          ruleId: RULE_ID,
          severity: "high",
          resourceType: "edge_function",
          resourceName: fn.slug,
          title: "Edge Function com service_role sem verificação clara do chamador",
          description: `A função "${fn.slug}" usa a service_role key mas não foi possível confirmar verificação do chamador.`,
          evidence: { function: fn.slug, verify_jwt: fn.verify_jwt, uses_service_role: usesSr },
          remediationSql: null,
          remediationSteps: ["Template de verificação:\n" + VERIFY_CALLER_TEMPLATE],
          docsUrl: DOCS_URL,
        });
      }

      if (hasOpenCorsWithAuth(body)) {
        findings.push({
          ruleId: RULE_ID,
          severity: "medium",
          resourceType: "edge_function",
          resourceName: fn.slug,
          title: "CORS aberto numa função que lê o header Authorization",
          description: `A função "${fn.slug}" aceita pedidos de qualquer origem (CORS *) e lê o header Authorization — vetor de CSRF/roubo de credenciais.`,
          evidence: { function: fn.slug },
          remediationSql: null,
          remediationSteps: ["Restringe Access-Control-Allow-Origin aos domínios que realmente precisam de chamar a função."],
          docsUrl: DOCS_URL,
        });
      }
    }

    return findings;
  },
};
