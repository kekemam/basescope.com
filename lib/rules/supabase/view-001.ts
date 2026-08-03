import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface ViewRow {
  view_name: string;
  relkind: "v" | "m";
  owner: string;
  anon_select: boolean;
  security_invoker: string;
  source_tables: string[] | null;
}

interface RlsRow {
  table_name: string;
  relrowsecurity: boolean;
}

const RULE_ID = "VIEW-001";
const DOCS_URL = docsUrlFor(RULE_ID);

function sourceIsProtected(sourceTables: string[] | null, rlsByTable: Map<string, boolean>): boolean {
  if (!sourceTables) return false;
  return sourceTables.some((qualified) => {
    const bareName = qualified.replace(/^public\./, "").replace(/"/g, "");
    return rlsByTable.get(bareName) === true;
  });
}

function remediation(view: string, relkind: "v" | "m") {
  if (relkind === "m") {
    return {
      sql: `revoke all on public.${view} from anon, authenticated;`,
      steps: [
        "Materialized views não suportam security_invoker.",
        "Revoga o acesso e serve os dados por uma função SECURITY INVOKER ou por uma tabela com RLS.",
      ],
    };
  }
  return {
    sql: `-- Postgres 15+ (todos os projetos Supabase novos)
alter view public.${view} set (security_invoker = true);

-- Alternativa universal
revoke all on public.${view} from anon, authenticated;`,
    steps: ["Ativa security_invoker na vista, ou revoga o acesso direto se não for necessário."],
  };
}

export const view001: Rule = {
  id: RULE_ID,
  title: "Vista que contorna RLS",
  severity: "critical",
  category: "views",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const views = await ctx.admin<ViewRow[]>`
      select c.relname as view_name,
             c.relkind,
             pg_get_userbyid(c.relowner) as owner,
             has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
             coalesce(
               (select option_value from pg_options_to_table(c.reloptions)
                 where option_name = 'security_invoker'), 'false'
             ) as security_invoker,
             (select array_agg(distinct d.refobjid::regclass::text)
                from pg_depend d
               where d.objid = r.oid and d.classid = 'pg_rewrite'::regclass
                 and d.refobjid <> c.oid) as source_tables
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_rewrite r on r.ev_class = c.oid
      where n.nspname = 'public'
        and c.relkind in ('v','m')
    `;

    const rlsRows = await ctx.admin<RlsRow[]>`
      select c.relname as table_name, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r','p')
    `;
    const rlsByTable = new Map(rlsRows.map((r) => [r.table_name, r.relrowsecurity]));

    const findings: Finding[] = [];

    for (const view of views) {
      if (!view.anon_select) continue;
      if (!sourceIsProtected(view.source_tables, rlsByTable)) continue;

      if (view.relkind === "v" && view.security_invoker === "true") continue;

      const remed = remediation(view.view_name, view.relkind);
      findings.push({
        ruleId: RULE_ID,
        severity: "critical",
        resourceType: "table",
        resourceName: `public.${view.view_name}`,
        title:
          view.relkind === "m"
            ? "Materialized view acessível a anon deriva de tabela protegida"
            : "Vista que contorna RLS",
        description: `public.${view.view_name} é legível por anon e deriva de uma tabela com RLS ativo, mas corre com os privilégios do dono (${view.owner}) em vez de respeitar as políticas.`,
        evidence: {
          view: view.view_name,
          kind: view.relkind === "m" ? "materialized_view" : "view",
          owner: view.owner,
          security_invoker: view.security_invoker,
          source_tables: view.source_tables,
        },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
