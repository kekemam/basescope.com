import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

/**
 * A Management API não garante expor a data de criação/rotação da
 * service_role key de forma estável entre versões — se o endpoint não
 * devolver um campo de data reconhecível, a regra não produz finding
 * (não verificável) em vez de arriscar um falso positivo/negativo.
 */
interface ApiKeyEntry {
  name?: string;
  id?: string;
  created_at?: string;
  inserted_at?: string;
}

const RULE_ID = "AUTH-007";
const DOCS_URL = docsUrlFor(RULE_ID);
const ROTATION_THRESHOLD_DAYS = 365;

function ageInDays(dateString: string): number {
  const created = new Date(dateString).getTime();
  return (Date.now() - created) / (1000 * 60 * 60 * 24);
}

export const auth007: Rule = {
  id: RULE_ID,
  title: "service_role key sem rotação há mais de 365 dias",
  severity: "low",
  category: "auth",
  async check(ctx: ScanContext): Promise<Finding[]> {
    if (!ctx.mgmtToken) return [];

    const res = await fetch(`https://api.supabase.com/v1/projects/${ctx.projectRef}/api-keys`, {
      headers: { Authorization: `Bearer ${ctx.mgmtToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const keys = (await res.json()) as ApiKeyEntry[];

    const serviceRoleKey = keys.find((k) => k.name === "service_role");
    const dateField = serviceRoleKey?.created_at ?? serviceRoleKey?.inserted_at;
    if (!dateField) return [];

    const age = ageInDays(dateField);
    if (age < ROTATION_THRESHOLD_DAYS) return [];

    return [
      {
        ruleId: RULE_ID,
        severity: "low",
        resourceType: "config",
        resourceName: "service_role key",
        title: "service_role key sem rotação há mais de 365 dias",
        description: `A service_role key tem ${Math.floor(age)} dias sem ser rodada — quanto mais tempo vive uma chave, maior a janela de exposição se algum dia tiver sido copiada para algum lado.`,
        evidence: { age_days: Math.floor(age) },
        remediationSql: null,
        remediationSteps: ["Roda a service_role key em Settings → API → Reset, e atualiza-a em todos os sítios onde está guardada."],
        docsUrl: DOCS_URL,
      },
    ];
  },
};
