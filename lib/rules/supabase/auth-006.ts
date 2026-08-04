import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

/**
 * A Management API não documenta um único campo estável para "MFA está
 * ativo" — testa-se um conjunto de chaves plausíveis (nomenclatura
 * consistente com `mailer_autoconfirm` etc.) e trata a ausência de todas
 * como "não verificável", não como "MFA desativado", para não gerar um
 * falso positivo por um campo mal adivinhado.
 */
interface AuthConfigMfaFields {
  mfa_totp_enroll_enabled?: boolean;
  mfa_phone_enroll_enabled?: boolean;
  mfa_webauthn_enroll_enabled?: boolean;
}

const RULE_ID = "AUTH-006";
const DOCS_URL = docsUrlFor(RULE_ID);
const KNOWN_MFA_FIELDS = ["mfa_totp_enroll_enabled", "mfa_phone_enroll_enabled", "mfa_webauthn_enroll_enabled"] as const;

export const auth006: Rule = {
  id: RULE_ID,
  title: "Nenhum provider MFA ativo",
  severity: "low",
  category: "auth",
  async check(ctx: ScanContext): Promise<Finding[]> {
    if (!ctx.mgmtToken) return [];

    const res = await fetch(`https://api.supabase.com/v1/projects/${ctx.projectRef}/config/auth`, {
      headers: { Authorization: `Bearer ${ctx.mgmtToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const config = (await res.json()) as AuthConfigMfaFields;

    const knownFieldsPresent = KNOWN_MFA_FIELDS.some((field) => config[field] !== undefined);
    if (!knownFieldsPresent) return [];

    const anyEnabled = KNOWN_MFA_FIELDS.some((field) => config[field] === true);
    if (anyEnabled) return [];

    return [
      {
        ruleId: RULE_ID,
        severity: "low",
        resourceType: "auth",
        resourceName: "auth.config.mfa",
        title: "Nenhum provider MFA ativo",
        description: "Nenhum método de autenticação multifator está ativo — uma password roubada chega para tomar conta de uma conta.",
        evidence: {
          mfa_totp_enroll_enabled: config.mfa_totp_enroll_enabled ?? null,
          mfa_phone_enroll_enabled: config.mfa_phone_enroll_enabled ?? null,
          mfa_webauthn_enroll_enabled: config.mfa_webauthn_enroll_enabled ?? null,
        },
        remediationSql: null,
        remediationSteps: ["Ativa pelo menos o TOTP em Authentication → Providers → Multi-Factor Authentication."],
        docsUrl: DOCS_URL,
      },
    ];
  },
};
