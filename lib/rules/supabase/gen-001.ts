import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

/**
 * Best-effort: não há neste momento confirmação contra a documentação viva
 * da Management API de que estes campos existem exatamente assim
 * (`plan`/`tier` no projeto, `pitr_enabled` no endpoint de backups). Se
 * qualquer um faltar, a regra não produz finding em vez de arriscar um
 * falso positivo/negativo — fica marcada como "não verificável" no relatório.
 */
interface ProjectDetails {
  plan?: string;
  tier?: string;
}

interface BackupSettings {
  pitr_enabled?: boolean;
}

const RULE_ID = "GEN-001";
const DOCS_URL = docsUrlFor(RULE_ID);
const FREE_PLAN_NAMES = new Set(["free", "FREE"]);

export const gen001: Rule = {
  id: RULE_ID,
  title: "Backups PITR desativados num projeto com plano pago",
  severity: "medium",
  category: "hygiene",
  async check(ctx: ScanContext): Promise<Finding[]> {
    if (!ctx.mgmtToken) return [];

    const [projectRes, backupsRes] = await Promise.all([
      fetch(`https://api.supabase.com/v1/projects/${ctx.projectRef}`, {
        headers: { Authorization: `Bearer ${ctx.mgmtToken}` },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`https://api.supabase.com/v1/projects/${ctx.projectRef}/database/backups`, {
        headers: { Authorization: `Bearer ${ctx.mgmtToken}` },
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (!projectRes.ok || !backupsRes.ok) return [];

    const project = (await projectRes.json()) as ProjectDetails;
    const backups = (await backupsRes.json()) as BackupSettings;

    const planField = project.plan ?? project.tier;
    if (!planField || backups.pitr_enabled === undefined) return [];

    const isFreePlan = FREE_PLAN_NAMES.has(planField);
    if (isFreePlan || backups.pitr_enabled) return [];

    return [
      {
        ruleId: RULE_ID,
        severity: "medium",
        resourceType: "config",
        resourceName: "database.backups",
        title: "Backups PITR desativados num projeto com plano pago",
        description: `O projeto está no plano "${planField}" mas Point-in-Time Recovery está desativado — sem PITR, um erro de escrita destrutivo só pode ser revertido até ao último backup diário.`,
        evidence: { plan: planField, pitr_enabled: false },
        remediationSql: null,
        remediationSteps: ["Ativa Point-in-Time Recovery em Settings → Database → Backups."],
        docsUrl: DOCS_URL,
      },
    ];
  },
};
