import type { Finding, Rule, Severity, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { PII_COLUMN_PATTERN } from "./_shared";

interface AuthConfig {
  mailer_autoconfirm: boolean;
  disable_signup: boolean;
  uri_allow_list: string;
  jwt_exp: number;
  password_min_length: number;
  security_update_password_require_reauthentication: boolean;
  password_hibp_enabled: boolean;
}

interface TableExistsRow {
  table_name: string;
}

interface PiiAuthReadableRow {
  table_name: string;
}

const RULE_ID = "AUTH-001";
const DOCS_URL = docsUrlFor(RULE_ID);
const PRIVATE_APP_TABLES = ["invitations", "invites", "team_members", "organization_members", "memberships"];

function finding(
  resourceName: string,
  severity: Severity,
  title: string,
  description: string,
  evidence: Record<string, unknown>,
  steps: string[],
): Finding {
  return {
    ruleId: RULE_ID,
    severity,
    resourceType: "auth",
    resourceName,
    title,
    description,
    evidence,
    remediationSql: null,
    remediationSteps: steps,
    docsUrl: DOCS_URL,
  };
}

export const auth001: Rule = {
  id: RULE_ID,
  title: "Confirmação de email desativada / configuração de auth fraca",
  severity: "high",
  category: "auth",
  async check(ctx: ScanContext): Promise<Finding[]> {
    // Sem OAuth não há acesso à Management API — a regra fica marcada como
    // "não verificada" pelo orquestrador, não produz findings falsos.
    if (!ctx.mgmtToken) return [];

    const res = await fetch(`https://api.supabase.com/v1/projects/${ctx.projectRef}/config/auth`, {
      headers: { Authorization: `Bearer ${ctx.mgmtToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const config = (await res.json()) as AuthConfig;

    const findings: Finding[] = [];

    // Heurística de app privada: existe alguma destas tabelas → a app é por convite.
    const privateAppTables = await ctx.admin<TableExistsRow[]>`
      select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r','p')
        and c.relname = any(${PRIVATE_APP_TABLES})
    `;
    const isPrivateApp = privateAppTables.length > 0;

    if (config.mailer_autoconfirm) {
      const piiReadableByAuth = await ctx.admin<PiiAuthReadableRow[]>`
        select distinct c.relname as table_name
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
        where n.nspname = 'public' and c.relkind in ('r','p')
          and a.attname ~* ${PII_COLUMN_PATTERN}
          and has_table_privilege('authenticated', c.oid, 'SELECT')
      `;

      const severity: Severity = piiReadableByAuth.length > 0 ? "critical" : "high";
      findings.push(
        finding(
          "auth.config.mailer_autoconfirm",
          severity,
          "Confirmação de email desativada",
          piiReadableByAuth.length > 0
            ? "A confirmação de email está desativada e qualquer autenticado consegue ler dados pessoais de outros — basta um email falso para entrar."
            : "A confirmação de email está desativada — contas são criadas sem provar posse do email.",
          {
            mailer_autoconfirm: true,
            pii_tables_readable_by_authenticated: piiReadableByAuth.map((r) => r.table_name),
          },
          ["Ativa a confirmação de email em Authentication → Providers."],
        ),
      );
    }

    if (config.disable_signup === false && isPrivateApp) {
      findings.push(
        finding(
          "auth.config.disable_signup",
          "medium",
          "Signup público aberto numa app que parece ser por convite",
          `Existe uma tabela de convites/membros (${privateAppTables.map((t) => t.table_name).join(", ")}) mas o registo público continua ativo.`,
          { disable_signup: config.disable_signup, private_app_tables: privateAppTables.map((t) => t.table_name) },
          ["Desativa o signup público e usa inviteUserByEmail() do lado do servidor."],
        ),
      );
    }

    if (config.uri_allow_list?.includes("*") || /http:\/\/(?!localhost)/.test(config.uri_allow_list ?? "")) {
      findings.push(
        finding(
          "auth.config.uri_allow_list",
          "high",
          "Redirect URLs com wildcard ou HTTP não-local",
          `A lista de redirect URLs permite padrões perigosos: "${config.uri_allow_list}".`,
          { uri_allow_list: config.uri_allow_list },
          ["Remove wildcards; lista cada URL de redirect exato, todos em HTTPS."],
        ),
      );
    }

    if (config.jwt_exp > 86400) {
      findings.push(
        finding(
          "auth.config.jwt_exp",
          "medium",
          "JWT expiry acima de 24h",
          `O JWT expira ao fim de ${config.jwt_exp}s — mais de 24h.`,
          { jwt_exp: config.jwt_exp },
          ["Reduz o JWT expiry para 3600s."],
        ),
      );
    }

    if (config.password_min_length < 8) {
      findings.push(
        finding(
          "auth.config.password_min_length",
          "medium",
          "Comprimento mínimo de password abaixo de 8",
          `password_min_length está definido para ${config.password_min_length}.`,
          { password_min_length: config.password_min_length },
          ["Define password_min_length para pelo menos 8."],
        ),
      );
    }

    if (config.security_update_password_require_reauthentication === false) {
      findings.push(
        finding(
          "auth.config.security_update_password_require_reauthentication",
          "medium",
          "Alteração de password não exige reautenticação",
          "Um utilizador pode alterar a própria password sem reautenticar — perigoso se a sessão for sequestrada.",
          { security_update_password_require_reauthentication: false },
          ["Ativa a exigência de reautenticação antes de alterar a password."],
        ),
      );
    }

    if (config.password_hibp_enabled === false) {
      findings.push(
        finding(
          "auth.config.password_hibp_enabled",
          "medium",
          "Proteção contra password comprometida desativada",
          "Novas passwords não são verificadas contra a base Have I Been Pwned.",
          { password_hibp_enabled: false },
          ["Ativa a proteção contra passwords comprometidas (plano Pro)."],
        ),
      );
    }

    return findings;
  },
};
