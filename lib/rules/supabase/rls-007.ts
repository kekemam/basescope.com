import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import type { PgPolicyRow } from "./_shared";

const RULE_ID = "RLS-007";
const DOCS_URL = docsUrlFor(RULE_ID);

function remediation(table: string, policyName: string) {
  return {
    sql: `drop policy if exists "${policyName}" on public.${table};

create policy "${table}_select_own" on public.${table}
  for select to authenticated using (auth.uid() = user_id);

create policy "${table}_insert_own" on public.${table}
  for insert to authenticated with check (auth.uid() = user_id);

create policy "${table}_update_own" on public.${table}
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "${table}_delete_own" on public.${table}
  for delete to authenticated using (auth.uid() = user_id);`,
    steps: [
      "Substitui a política FOR ALL por quatro políticas, uma por operação.",
      "É mais verboso, mas torna impossível uma divergência USING/WITH CHECK passar despercebida (ver RLS-003).",
    ],
  };
}

/**
 * Regra de higiene, não de exposição direta — por isso Medium mesmo quando
 * a política em si não tem nenhuma divergência perigosa (essa parte é
 * RLS-003). Aqui sinaliza-se o padrão FOR ALL em si, por ser a causa raiz
 * da classe de bug.
 */
export const rls007: Rule = {
  id: RULE_ID,
  title: "Política FOR ALL onde deveriam existir políticas separadas por operação",
  severity: "medium",
  category: "rls",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const policies = await ctx.admin<PgPolicyRow[]>`
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public' and cmd = 'ALL'
      order by tablename, policyname
    `;

    return policies.map((policy) => {
      const remed = remediation(policy.tablename, policy.policyname);
      return {
        ruleId: RULE_ID,
        severity: "medium" as const,
        resourceType: "policy" as const,
        resourceName: `${policy.tablename}.${policy.policyname}`,
        title: "Política FOR ALL onde deveriam existir políticas separadas",
        description: `A política "${policy.policyname}" em public.${policy.tablename} usa FOR ALL — separar por operação torna impossível uma divergência USING/WITH CHECK passar despercebida.`,
        evidence: { table: policy.tablename, policy: policy.policyname, roles: policy.roles },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      };
    });
  },
};
