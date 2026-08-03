import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { normalize, OPEN, rolesInclude, type PgPolicyRow } from "./_shared";

const RULE_ID = "RLS-003";
const DOCS_URL = docsUrlFor(RULE_ID);

function matchedCases(policy: PgPolicyRow): string[] {
  const qual = normalize(policy.qual);
  const check = normalize(policy.with_check);
  const matched: string[] = [];

  // Caso A: FOR ALL/UPDATE com USING restritivo e WITH CHECK aberto.
  if (["ALL", "UPDATE"].includes(policy.cmd) && qual && !OPEN.has(qual) && check && OPEN.has(check)) {
    matched.push("using-restritivo-check-aberto");
  }

  // Caso B: WITH CHECK aberto ou ausente onde isso é de facto perigoso.
  // Nota de reconciliação com a secção "NÃO reportes" do doc: num policy
  // FOR ALL/UPDATE, se WITH CHECK for omitido o Postgres usa USING como
  // verificação de escrita — omitir só é perigoso se o USING também não
  // proteger nada. Para FOR INSERT puro não há USING, por isso omitir dá
  // `true` implícito e é sempre perigoso.
  if (rolesInclude(policy.roles, "authenticated")) {
    const checkMissingOrOpen = !check || OPEN.has(check);
    if (policy.cmd === "INSERT" && checkMissingOrOpen) {
      matched.push("insert-sem-with-check-efetivo");
    }
    if (policy.cmd === "ALL" && checkMissingOrOpen && (!qual || OPEN.has(qual))) {
      matched.push("all-sem-protecao-efetiva");
    }
  }

  // Caso C: divergência estrutural — USING referencia auth.uid(), WITH CHECK não.
  if (qual.includes("auth.uid()") && check && !check.includes("auth.uid()")) {
    matched.push("divergencia-auth-uid");
  }

  return matched;
}

function remediation(table: string, policyName: string) {
  return {
    sql: `drop policy if exists "${policyName}" on public.${table};

create policy "${table}_select_own" on public.${table}
  for select to authenticated using (auth.uid() = user_id);

create policy "${table}_insert_own" on public.${table}
  for insert to authenticated with check (auth.uid() = user_id);

create policy "${table}_update_own" on public.${table}
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "${table}_delete_own" on public.${table}
  for delete to authenticated using (auth.uid() = user_id);`,
    steps: [
      "Remove a política divergente.",
      "Recria com políticas separadas por operação (SELECT/INSERT/UPDATE/DELETE) em vez de FOR ALL.",
      "Garante que USING e WITH CHECK usam a mesma condição de posse (`auth.uid() = user_id`).",
    ],
  };
}

export const rls003: Rule = {
  id: RULE_ID,
  title: "WITH CHECK mais permissivo que USING (escalada de privilégios)",
  severity: "critical",
  category: "rls",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const policies = await ctx.admin<PgPolicyRow[]>`
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public'
      order by tablename, policyname
    `;

    const findings: Finding[] = [];

    for (const policy of policies) {
      const matched = matchedCases(policy);
      if (matched.length === 0) continue;

      const remed = remediation(policy.tablename, policy.policyname);
      findings.push({
        ruleId: RULE_ID,
        severity: "critical",
        resourceType: "policy",
        resourceName: `${policy.tablename}.${policy.policyname}`,
        title: "WITH CHECK mais permissivo que USING",
        description: `A política "${policy.policyname}" em public.${policy.tablename} permite escrever linhas que a própria política não deixaria ler.`,
        evidence: {
          table: policy.tablename,
          policy: policy.policyname,
          cmd: policy.cmd,
          roles: policy.roles,
          qual: policy.qual,
          with_check: policy.with_check,
          matched_patterns: matched,
        },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
