import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface AnonReadableTableRow {
  table_name: string;
}

const RULE_ID = "CLIENT-006";
const DOCS_URL = docsUrlFor(RULE_ID);

/**
 * Distinção face a ANON-001: aquela regra prova exposição de DADOS (conta
 * linhas reais via HEAD por tabela). Esta é sobre reconhecimento — o root
 * do PostgREST (`GET /rest/v1/`) devolve sempre a spec OpenAPI a quem tiver
 * a anon key, e isso já revela a lista completa de tabelas do schema
 * público sem precisar de adivinhar nomes. A evidência aqui é só a lista
 * de nomes de tabelas, nunca linhas.
 */
export const client006: Rule = {
  id: RULE_ID,
  title: "Schema da base de dados enumerável via PostgREST",
  severity: "high",
  category: "client-exposure",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const anonReadableTables = await ctx.admin<AnonReadableTableRow[]>`
      select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r','p','v')
        and has_table_privilege('anon', c.oid, 'SELECT')
      order by c.relname
    `;

    if (anonReadableTables.length === 0) return [];

    return [
      {
        ruleId: RULE_ID,
        severity: "high",
        resourceType: "config",
        resourceName: "PostgREST /rest/v1/",
        title: "Schema da base de dados enumerável via PostgREST",
        description: `Qualquer pessoa com a anon key consegue listar ${anonReadableTables.length} tabelas do schema public através do endpoint OpenAPI do PostgREST — não é preciso adivinhar nomes de tabelas.`,
        evidence: { anon_readable_table_count: anonReadableTables.length, tables: anonReadableTables.map((t) => t.table_name) },
        remediationSql: null,
        remediationSteps: [
          "A anon key é pública por design — o problema real é quais tabelas têm SELECT concedido a anon (ver RLS-001/ANON-001), não o endpoint em si.",
          "Se preferires esconder a estrutura do schema, coloca um gateway/proxy à frente do PostgREST.",
        ],
        docsUrl: DOCS_URL,
      },
    ];
  },
};
