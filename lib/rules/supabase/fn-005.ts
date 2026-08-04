import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { PII_COLUMN_PATTERN } from "./_shared";

interface TriggerRow {
  trigger_name: string;
  source_table: string;
  anon_can_insert: boolean;
  anon_can_update: boolean;
  trigger_body: string;
}

interface PiiTableNameRow {
  table_name: string;
}

const RULE_ID = "FN-005";
const DOCS_URL = docsUrlFor(RULE_ID);

const INSERT_TARGET_PATTERN = /insert\s+into\s+(?:public\.)?"?(\w+)"?/gi;
const RAW_INPUT_PATTERN = /\bnew\.\w+/i;

function extractInsertTargets(body: string): string[] {
  const targets = new Set<string>();
  for (const match of body.matchAll(INSERT_TARGET_PATTERN)) {
    if (match[1]) targets.add(match[1]);
  }
  return [...targets];
}

/**
 * Só dispara quando a tabela de origem (a que o trigger está associado) é
 * escrevível por `anon` — é esse o caso realmente perigoso: input não
 * autenticado a propagar-se, via trigger, para uma tabela com dados
 * pessoais. Isto também evita falsos positivos com triggers internos do
 * próprio Basescope, cujas tabelas de origem nunca são anon-writable.
 */
export const fn005: Rule = {
  id: RULE_ID,
  title: "Trigger propaga input não autenticado para tabela com dados pessoais",
  severity: "medium",
  category: "functions",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const piiTables = await ctx.admin<PiiTableNameRow[]>`
      select distinct c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      where n.nspname = 'public' and c.relkind in ('r','p')
        and a.attname ~* ${PII_COLUMN_PATTERN}
    `;
    const piiTableNames = new Set(piiTables.map((t) => t.table_name));
    if (piiTableNames.size === 0) return [];

    const triggers = await ctx.admin<TriggerRow[]>`
      select trg.tgname as trigger_name,
             src_tbl.relname as source_table,
             has_table_privilege('anon', src_tbl.oid, 'INSERT') as anon_can_insert,
             has_table_privilege('anon', src_tbl.oid, 'UPDATE') as anon_can_update,
             pg_get_functiondef(trg.tgfoid) as trigger_body
      from pg_trigger trg
      join pg_class src_tbl on src_tbl.oid = trg.tgrelid
      join pg_namespace src_ns on src_ns.oid = src_tbl.relnamespace
      where src_ns.nspname = 'public' and not trg.tgisinternal
    `;

    const findings: Finding[] = [];

    for (const trigger of triggers) {
      if (!trigger.anon_can_insert && !trigger.anon_can_update) continue;
      if (!RAW_INPUT_PATTERN.test(trigger.trigger_body)) continue;

      const targets = extractInsertTargets(trigger.trigger_body).filter((t) => piiTableNames.has(t));
      if (targets.length === 0) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: "medium",
        resourceType: "function",
        resourceName: trigger.trigger_name,
        title: "Trigger propaga input não autenticado para tabela com dados pessoais",
        description: `O trigger "${trigger.trigger_name}" em public.${trigger.source_table} (escrevível por anon) escreve em ${targets.join(", ")}, que contém dados pessoais.`,
        evidence: { trigger: trigger.trigger_name, source_table: trigger.source_table, target_tables: targets },
        remediationSql: null,
        remediationSteps: [
          "Valida e sanitiza os valores de NEW.* antes de os escrever na tabela alvo.",
          "Considera se a tabela de origem devia mesmo ser escrevível por anon.",
        ],
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
