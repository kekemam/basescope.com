import type { Finding, Rule, Severity, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface FnRow {
  schema_name: string;
  function_name: string;
  args: string;
  is_security_definer: boolean;
  owner: string;
  anon_execute: boolean;
  auth_execute: boolean;
}

const RULE_ID = "FN-001";
const DOCS_URL = docsUrlFor(RULE_ID);

const SYSTEM_OWNERS = new Set([
  "supabase_admin",
  "supabase_auth_admin",
  "supabase_storage_admin",
  "postgres",
]);

function isInternalFunction(row: FnRow): boolean {
  if (row.function_name.startsWith("pgrst_") || row.function_name.startsWith("_supabase")) return true;
  return SYSTEM_OWNERS.has(row.owner) && row.schema_name !== "public";
}

function severityFor(row: FnRow): Severity {
  if (row.anon_execute || row.auth_execute) return "critical";
  return "medium";
}

function remediation(schema: string, fn: string, args: string) {
  return {
    sql: `alter function ${schema}.${fn}(${args}) set search_path = '';`,
    steps: [
      "Fixa o search_path da função. Isto pode partir a função se ela usar nomes não-qualificados (ex.: `select * from users` em vez de `select * from public.users`) — revê o corpo antes de aplicar.",
      `Alternativa menos intrusiva: alter function ${schema}.${fn}(${args}) set search_path = public, pg_temp; (menos seguro, mas fecha o vetor principal — marca como mitigação parcial).`,
    ],
  };
}

export const fn001: Rule = {
  id: RULE_ID,
  title: "Função SECURITY DEFINER sem search_path fixo",
  severity: "critical",
  category: "functions",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const rows = await ctx.admin<FnRow[]>`
      select n.nspname as schema_name,
             p.proname as function_name,
             pg_get_function_identity_arguments(p.oid) as args,
             p.prosecdef as is_security_definer,
             pg_get_userbyid(p.proowner) as owner,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog', 'information_schema', 'extensions',
                              'graphql', 'graphql_public', 'pgbouncer', 'realtime',
                              'storage', 'vault', 'supabase_functions', 'net', 'cron')
        and p.prosecdef = true
        and (
          p.proconfig is null
          or not exists (
            select 1 from unnest(p.proconfig) cfg
            where cfg like 'search_path=%'
          )
        )
    `;

    const findings: Finding[] = [];

    for (const row of rows) {
      if (isInternalFunction(row)) continue;

      const severity = severityFor(row);
      const remed = remediation(row.schema_name, row.function_name, row.args);
      findings.push({
        ruleId: RULE_ID,
        severity,
        resourceType: "function",
        resourceName: `${row.schema_name}.${row.function_name}(${row.args})`,
        title: "Função SECURITY DEFINER sem search_path fixo",
        description: `A função ${row.schema_name}.${row.function_name} corre com privilégios do dono (${row.owner}) mas não fixa o search_path — vetor de escalada por sequestro de schema.`,
        evidence: {
          schema: row.schema_name,
          function: row.function_name,
          owner: row.owner,
          anon_execute: row.anon_execute,
          auth_execute: row.auth_execute,
        },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
