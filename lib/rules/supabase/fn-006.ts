import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface ExtensionRow {
  extension_name: string;
  schema_name: string;
}

const RULE_ID = "FN-006";
const DOCS_URL = docsUrlFor(RULE_ID);

export const fn006: Rule = {
  id: RULE_ID,
  title: "Extensão instalada no schema public em vez de extensions",
  severity: "low",
  category: "functions",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const rows = await ctx.admin<ExtensionRow[]>`
      select e.extname as extension_name, n.nspname as schema_name
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
      where n.nspname = 'public'
    `;

    return rows.map((row) => ({
      ruleId: RULE_ID,
      severity: "low" as const,
      resourceType: "config" as const,
      resourceName: row.extension_name,
      title: "Extensão instalada no schema public",
      description: `A extensão "${row.extension_name}" está instalada em public — mistura funções de terceiros com o teu schema de aplicação e pode colidir com objetos futuros.`,
      evidence: { extension: row.extension_name, schema: row.schema_name },
      remediationSql: `-- Requer recriar a extensão (não há ALTER EXTENSION SET SCHEMA para todas as versões)
create schema if not exists extensions;
drop extension if exists "${row.extension_name}";
create extension "${row.extension_name}" with schema extensions;`,
      remediationSteps: [
        "Move a extensão para o schema `extensions` — pode implicar recriar objetos que dependem dela.",
        "Confirma que o search_path das tuas funções continua a encontrar as funções da extensão depois da mudança.",
      ],
      docsUrl: DOCS_URL,
    }));
  },
};
