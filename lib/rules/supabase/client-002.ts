import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { fetchBundlesForDomain } from "./_client-shared";

const RULE_ID = "CLIENT-002";
const DOCS_URL = docsUrlFor(RULE_ID);

interface SecretPattern {
  name: string;
  re: RegExp;
  /** Exige um destes termos num raio de 100 caracteres antes do match — reduz ruído de padrões genéricos. */
  requiresContext?: RegExp;
}

const SECRETS: SecretPattern[] = [
  { name: "Stripe secret key", re: /sk_live_[A-Za-z0-9]{20,}/g },
  { name: "Stripe restricted key", re: /rk_live_[A-Za-z0-9]{20,}/g },
  { name: "Resend API key", re: /\bre_[A-Za-z0-9]{20,}/g },
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  {
    name: "OpenAI API key",
    re: /sk-(proj-)?[A-Za-z0-9_-]{32,}/g,
    requiresContext: /apiKey|Authorization|Bearer/,
  },
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "Twilio API key", re: /\bSK[0-9a-fA-F]{32}\b/g },
  { name: "SendGrid API key", re: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g },
  { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9]{36}/g },
  { name: "Slack token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: "Private key block", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

// Falsos positivos explícitos: chaves de teste/públicas nunca são segredo.
// Nota: "Google API key" (AIza...) fica deliberadamente fora de SECRETS —
// é indistinguível, só por regex, da API key pública do Firebase, que o
// doc manda excluir sempre. Sinalizá-la geraria ruído maioritariamente falso.
const EXCLUDE_NEARBY = /sk_test_|pk_live_|pk_test_/;

const SENSITIVE_ENDPOINTS: Array<{ path: string; severity: "critical" | "high" }> = [
  { path: "/.env", severity: "critical" },
  { path: "/.env.local", severity: "critical" },
  { path: "/.env.production", severity: "critical" },
  { path: "/.git/config", severity: "critical" },
  { path: "/.git/HEAD", severity: "critical" },
  { path: "/config.json", severity: "high" },
  { path: "/appsettings.json", severity: "high" },
  { path: "/api/debug", severity: "high" },
  { path: "/api/health?verbose=true", severity: "high" },
];

function hasContext(content: string, matchIndex: number, pattern: RegExp): boolean {
  const windowStart = Math.max(0, matchIndex - 100);
  return pattern.test(content.slice(windowStart, matchIndex));
}

export const client002: Rule = {
  id: RULE_ID,
  title: "Segredos de terceiros no bundle",
  severity: "critical",
  category: "client-exposure",
  async check(ctx: ScanContext): Promise<Finding[]> {
    if (!ctx.verifiedDomain) return [];

    const findings: Finding[] = [];
    const bundles = await fetchBundlesForDomain(ctx.verifiedDomain);

    for (const bundle of bundles) {
      for (const pattern of SECRETS) {
        for (const match of bundle.content.matchAll(pattern.re)) {
          const value = match[0];
          if (EXCLUDE_NEARBY.test(value)) continue;
          if (pattern.requiresContext && !hasContext(bundle.content, match.index ?? 0, pattern.requiresContext)) {
            continue;
          }

          findings.push({
            ruleId: RULE_ID,
            severity: "critical",
            resourceType: "client",
            resourceName: bundle.path,
            title: `${pattern.name} exposta no cliente`,
            description: `Encontrado um segredo do tipo "${pattern.name}" dentro de ${bundle.path}.`,
            evidence: { file: bundle.path, offset: match.index ?? null, prefix: value.slice(0, 8), type: pattern.name },
            remediationSql: null,
            remediationSteps: [
              "Roda a chave no fornecedor.",
              "Remove-a do código cliente.",
              "Move-a para uma variável de ambiente de servidor.",
              "Redeploy.",
              "Verifica a faturação do fornecedor por uso indevido.",
            ],
            docsUrl: DOCS_URL,
          });
        }
      }
    }

    for (const endpoint of SENSITIVE_ENDPOINTS) {
      const res = await fetch(`https://${ctx.verifiedDomain}${endpoint.path}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(3000),
      }).catch(() => null);
      if (!res || res.status !== 200) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: endpoint.severity,
        resourceType: "client",
        resourceName: endpoint.path,
        title: `Endpoint sensível acessível publicamente: ${endpoint.path}`,
        description: `${endpoint.path} devolveu 200 — está acessível publicamente sem autenticação.`,
        evidence: { path: endpoint.path, status: res.status },
        remediationSql: null,
        remediationSteps: ["Remove ou bloqueia o acesso público a este ficheiro/endpoint no servidor/deploy."],
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
