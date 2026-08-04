import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { PII_COLUMN_PATTERN } from "./_shared";

interface OrphanCandidateRow {
  table_name: string;
  pii_columns: string[];
  last_seq_scan: string | null;
  last_idx_scan: string | null;
}

const RULE_ID = "GEN-003";
const DOCS_URL = docsUrlFor(RULE_ID);
const UNUSED_THRESHOLD_DAYS = 90;

function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  return (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);
}

export const gen003: Rule = {
  id: RULE_ID,
  title: "Tabela órfã com dados pessoais sem uso há 90+ dias",
  severity: "low",
  category: "hygiene",
  async check(ctx: ScanContext): Promise<Finding[]> {
    // pg_stat_user_tables.last_seq_scan / last_idx_scan (Postgres 16+):
    // se ambos forem nulos ou anteriores ao limite, a tabela não é lida há
    // muito tempo — não distingue "nunca leram" de "leram há 91 dias", e é
    // reiniciado se as estatísticas forem limpas (ex.: `pg_stat_reset()`).
    const rows = await ctx.admin<OrphanCandidateRow[]>`
      select c.relname as table_name,
             array_agg(distinct a.attname) as pii_columns,
             s.last_seq_scan,
             s.last_idx_scan
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      left join pg_stat_user_tables s on s.relid = c.oid
      where n.nspname = 'public' and c.relkind in ('r','p')
        and a.attname ~* ${PII_COLUMN_PATTERN}
      group by c.relname, s.last_seq_scan, s.last_idx_scan
    `;

    const findings: Finding[] = [];

    for (const row of rows) {
      const seqAge = daysSince(row.last_seq_scan);
      const idxAge = daysSince(row.last_idx_scan);
      const mostRecentAccessAge = [seqAge, idxAge].filter((v): v is number => v !== null).sort((a, b) => a - b)[0];

      // Nunca houve seq scan nem index scan registados = sem sinal de leitura.
      const neverAccessed = row.last_seq_scan === null && row.last_idx_scan === null;
      if (!neverAccessed && (mostRecentAccessAge === undefined || mostRecentAccessAge < UNUSED_THRESHOLD_DAYS)) {
        continue;
      }

      findings.push({
        ruleId: RULE_ID,
        severity: "low",
        resourceType: "table",
        resourceName: `public.${row.table_name}`,
        title: "Tabela órfã com dados pessoais sem uso há 90+ dias",
        description: neverAccessed
          ? `public.${row.table_name} contém dados pessoais (${row.pii_columns.join(", ")}) e não há registo de leitura desde que as estatísticas começaram a ser contadas.`
          : `public.${row.table_name} contém dados pessoais (${row.pii_columns.join(", ")}) e não é lida há ${Math.floor(mostRecentAccessAge ?? 0)} dias.`,
        evidence: {
          table: row.table_name,
          pii_columns: row.pii_columns,
          last_seq_scan: row.last_seq_scan,
          last_idx_scan: row.last_idx_scan,
        },
        remediationSql: null,
        remediationSteps: [
          "Confirma se a tabela ainda é necessária.",
          "Se não for, apaga-a (reduz a superfície de dados pessoais sob RGPD).",
          "Se for, mas só de leitura rara, documenta porquê para não a assinalares por engano no futuro.",
        ],
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
