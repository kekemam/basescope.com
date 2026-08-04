export interface RemediationSqlItem {
  ruleId: string;
  resourceName: string;
  title: string;
  remediationSql: string | null;
}

/**
 * Ordem heurística, não um grafo de dependências real: privilégios de
 * schema/extensões primeiro (GRANT, FN), depois RLS (RLS, PII), depois
 * storage — corrigir a política antes de a tabela ter RLS ativo não faz
 * sentido, por exemplo. Partilhado entre o botão da página de achados e o
 * command menu para não haver duas heurísticas a divergir.
 */
const CATEGORY_ORDER = ["GRANT", "FN", "RLS", "PII", "VIEW", "STO", "AUTH", "EF"];

function categoryRank(ruleId: string): number {
  const prefix = ruleId.split("-")[0] ?? "";
  const index = CATEGORY_ORDER.indexOf(prefix);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function buildCombinedSqlScript(items: RemediationSqlItem[]): string {
  const withSql = items.filter((f) => f.remediationSql).sort((a, b) => categoryRank(a.ruleId) - categoryRank(b.ruleId));

  if (withSql.length === 0) return "-- Sem SQL de correção automática para os achados críticos.";

  const sections = withSql.map((f) => `-- ${f.ruleId} · ${f.resourceName}\n-- ${f.title}\n${f.remediationSql}`);

  return `-- Basescope · SQL de correção combinado\n-- Ordem heurística: schema/extensões → RLS → storage. Revê antes de correr.\n\n${sections.join("\n\n")}\n`;
}
