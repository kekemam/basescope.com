import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface FnBodyRow {
  schema_name: string;
  function_name: string;
  args: string;
  definition: string;
  owner: string;
  anon_execute: boolean;
  auth_execute: boolean;
}

const RULE_ID = "FN-003";
const DOCS_URL = docsUrlFor(RULE_ID);

const WRITE_STATEMENT_PATTERN = /\b(insert\s+into|update\s+\w|delete\s+from)\b/i;
const AUTH_UID_PATTERN = /auth\.uid\s*\(\s*\)/i;

const SYSTEM_OWNERS = new Set(["supabase_admin", "supabase_auth_admin", "supabase_storage_admin", "postgres"]);

function isInternalFunction(row: FnBodyRow): boolean {
  if (row.function_name.startsWith("pgrst_") || row.function_name.startsWith("_supabase")) return true;
  return SYSTEM_OWNERS.has(row.owner) && row.schema_name !== "public";
}

function remediation(schema: string, fn: string, args: string) {
  return {
    sql: null,
    steps: [
      `Revê o corpo de ${schema}.${fn}(${args}) e adiciona uma verificação explícita (\`if auth.uid() is null or ... then raise exception 'unauthorized'; end if;\`) antes de qualquer INSERT/UPDATE/DELETE.`,
      "Garante que a condição liga a linha escrita ao utilizador autenticado (ex.: `user_id = auth.uid()`), não só que existe alguma sessão.",
    ],
  };
}

export const fn003: Rule = {
  id: RULE_ID,
  title: "Função escreve na base de dados sem validar auth.uid()",
  severity: "high",
  category: "functions",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const rows = await ctx.admin<FnBodyRow[]>`
      select n.nspname as schema_name,
             p.proname as function_name,
             pg_get_function_identity_arguments(p.oid) as args,
             pg_get_functiondef(p.oid) as definition,
             pg_get_userbyid(p.proowner) as owner,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind = 'f'
        and (has_function_privilege('anon', p.oid, 'EXECUTE')
          or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    `;

    const findings: Finding[] = [];

    for (const row of rows) {
      if (isInternalFunction(row)) continue;
      if (!WRITE_STATEMENT_PATTERN.test(row.definition)) continue;
      if (AUTH_UID_PATTERN.test(row.definition)) continue;

      const remed = remediation(row.schema_name, row.function_name, row.args);
      findings.push({
        ruleId: RULE_ID,
        severity: row.anon_execute ? "critical" : "high",
        resourceType: "function",
        resourceName: `${row.schema_name}.${row.function_name}(${row.args})`,
        title: "Função escreve na base de dados sem validar auth.uid()",
        description: `${row.schema_name}.${row.function_name} escreve na base de dados mas o corpo não referencia auth.uid() em lado nenhum — não há forma de ligar a escrita a um utilizador autenticado.`,
        evidence: {
          schema: row.schema_name,
          function: row.function_name,
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
