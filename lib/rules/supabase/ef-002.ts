import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface EdgeFunctionSummary {
  slug: string;
  verify_jwt: boolean;
  status: string;
  version: number;
}

const RULE_ID = "EF-002";
const DOCS_URL = docsUrlFor(RULE_ID);

const WEBHOOK_SIGNATURE_HEADER_PATTERN =
  /stripe-signature|x-hub-signature|svix-signature|x-webhook-signature|x-signature/i;
const HMAC_VERIFICATION_PATTERN = /createHmac|timingSafeEqual|constructEvent|verifyWebhookSignature|svix/i;

export const ef002: Rule = {
  id: RULE_ID,
  title: "Webhook sem verificação de assinatura HMAC",
  severity: "high",
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
      if (fn.verify_jwt) continue; // se exige JWT, não é um webhook público

      const bodyRes = await fetch(
        `https://api.supabase.com/v1/projects/${ctx.projectRef}/functions/${fn.slug}/body`,
        { headers: { Authorization: `Bearer ${ctx.mgmtToken}` }, signal: AbortSignal.timeout(5000) },
      );
      if (!bodyRes.ok) continue;
      const body = await bodyRes.text();

      const looksLikeWebhook = /webhook|hook/i.test(fn.slug) || WEBHOOK_SIGNATURE_HEADER_PATTERN.test(body);
      if (!looksLikeWebhook) continue;
      if (HMAC_VERIFICATION_PATTERN.test(body)) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: "high",
        resourceType: "edge_function",
        resourceName: fn.slug,
        title: "Webhook sem verificação de assinatura HMAC",
        description: `A função "${fn.slug}" tem forma de webhook (verify_jwt desativado) mas não verifica a assinatura do payload — qualquer pessoa pode forjar pedidos.`,
        evidence: { function: fn.slug, verify_jwt: fn.verify_jwt },
        remediationSql: null,
        remediationSteps: [
          "Verifica a assinatura do payload com HMAC (ou o SDK do fornecedor, ex. `stripe.webhooks.constructEvent`) antes de processar o pedido.",
        ],
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
