import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendScanReadyEmail, sendNewCriticalFindingEmail } from "@/lib/email/resend";
import { sendSlackAlert, sendDiscordAlert } from "./dispatch";
import { getProjectOwnerEmail } from "@/lib/email/notify-org";
import type { Severity } from "@/lib/rules/types";

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const THRESHOLD_RANK: Record<string, number> = { all: 3, high_and_above: 1, critical_only: 0 };

export interface NotifiableFinding {
  ruleId: string;
  resourceName: string;
  severity: Severity;
}

/**
 * Alertas de um scan (PROJECT_SPEC § 6.3). Scans manuais avisam sempre que
 * o relatório está pronto — o utilizador está à espera. Scans agendados só
 * avisam quando há achado novo (ou uma regressão — um achado que tinha sido
 * corrigido e voltou a aparecer, o que cai na mesma definição de "não
 * estava aberto antes, está aberto agora") acima do limiar escolhido em
 * notification_settings. Nunca um email/mensagem "está tudo bem" — treina
 * as pessoas a ignorar.
 */
export async function dispatchScanNotifications(params: {
  projectId: string;
  projectName: string;
  trigger: "manual" | "scheduled" | "api" | "webhook";
  score: number;
  criticalCount: number;
  newFindings: NotifiableFinding[];
  reportUrl: string;
}): Promise<void> {
  const { projectId, projectName, trigger, score, criticalCount, newFindings, reportUrl } = params;
  const admin = createAdminClient();

  const { data: settingsRow } = await admin
    .from("notification_settings")
    .select("email_enabled, slack_webhook_url, discord_webhook_url, notify_on")
    .eq("project_id", projectId)
    .maybeSingle();

  const settings = settingsRow ?? {
    email_enabled: true,
    slack_webhook_url: null as string | null,
    discord_webhook_url: null as string | null,
    notify_on: "high_and_above" as string,
  };

  const threshold = THRESHOLD_RANK[settings.notify_on] ?? THRESHOLD_RANK.high_and_above!;
  const qualifying = newFindings.filter((f) => SEVERITY_RANK[f.severity] <= threshold);

  if (trigger !== "manual" && qualifying.length === 0) return;

  if (settings.email_enabled) {
    const ownerEmail = await getProjectOwnerEmail(projectId);
    if (ownerEmail) {
      if (trigger === "manual") {
        await sendScanReadyEmail(ownerEmail, projectName, score, criticalCount, reportUrl);
      }
      for (const f of qualifying.filter((f) => f.severity === "critical")) {
        await sendNewCriticalFindingEmail(ownerEmail, projectName, f.ruleId, f.resourceName, reportUrl);
      }
    }
  }

  if (qualifying.length > 0 && (settings.slack_webhook_url || settings.discord_webhook_url)) {
    const lines = qualifying.slice(0, 10).map((f) => `• [${f.severity.toUpperCase()}] ${f.ruleId} em ${f.resourceName}`);
    const more = qualifying.length > 10 ? `\n… e mais ${qualifying.length - 10}.` : "";
    const message = `*${projectName}* — ${qualifying.length} achado(s) novo(s) neste scan.\n${lines.join("\n")}${more}\n${reportUrl}`;

    if (settings.slack_webhook_url) await sendSlackAlert(settings.slack_webhook_url, message);
    if (settings.discord_webhook_url) await sendDiscordAlert(settings.discord_webhook_url, message);
  }
}
