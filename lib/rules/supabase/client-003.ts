import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { fetchBundlesForDomain } from "./_client-shared";

const RULE_ID = "CLIENT-003";
const DOCS_URL = docsUrlFor(RULE_ID);
const SOURCE_MAPPING_COMMENT = /\/\/#\s*sourceMappingURL=(\S+)/;

export const client003: Rule = {
  id: RULE_ID,
  title: "Source maps publicados em produção",
  severity: "medium",
  category: "client-exposure",
  async check(ctx: ScanContext): Promise<Finding[]> {
    if (!ctx.verifiedDomain) return [];

    const bundles = await fetchBundlesForDomain(ctx.verifiedDomain);
    const findings: Finding[] = [];

    for (const bundle of bundles) {
      const commentMatch = SOURCE_MAPPING_COMMENT.exec(bundle.content);
      const candidateUrls = new Set<string>();
      if (commentMatch?.[1] && !commentMatch[1].startsWith("data:")) {
        try {
          candidateUrls.add(new URL(commentMatch[1], bundle.path).toString());
        } catch {
          // URL relativo inválido — ignora
        }
      }
      if (bundle.path.endsWith(".js")) {
        candidateUrls.add(`${bundle.path}.map`);
      }

      for (const mapUrl of candidateUrls) {
        try {
          const res = await fetch(mapUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
          if (res.status !== 200) continue;

          findings.push({
            ruleId: RULE_ID,
            severity: "medium",
            resourceType: "client",
            resourceName: mapUrl,
            title: "Source map publicado em produção",
            description: `O source map de ${bundle.path} está acessível publicamente — expõe o código-fonte original, incluindo comentários e nomes de variáveis.`,
            evidence: { bundle: bundle.path, source_map: mapUrl },
            remediationSql: null,
            remediationSteps: ["Desativa a geração/publicação de source maps em produção (ex.: `productionBrowserSourceMaps: false` no Next.js)."],
            docsUrl: DOCS_URL,
          });
          break;
        } catch {
          // bundle individual falhou — não aborta o scan inteiro
        }
      }
    }

    return findings;
  },
};
