import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DefinicoesView } from "./definicoes-view";

export default async function DefinicoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, org_id, connection_status, verified_domain")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const { data: notif } = await supabase
    .from("notification_settings")
    .select("email_enabled, slack_webhook_url, discord_webhook_url, notify_on")
    .eq("project_id", id)
    .maybeSingle();

  const { data: org } = await supabase.from("organizations").select("plan").eq("id", project.org_id).maybeSingle();

  const { data: nextJob } = await supabase
    .from("scan_jobs")
    .select("status, scheduled_for")
    .eq("project_id", id)
    .in("status", ["queued", "running"])
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <DefinicoesView
      projectId={project.id}
      projectName={project.name}
      connectionStatus={project.connection_status}
      verifiedDomain={project.verified_domain}
      plan={org?.plan ?? "free"}
      nextScanJob={nextJob ? { status: nextJob.status, scheduledFor: nextJob.scheduled_for } : null}
      notificationSettings={
        notif
          ? {
              emailEnabled: notif.email_enabled,
              slackWebhookUrl: notif.slack_webhook_url ?? "",
              discordWebhookUrl: notif.discord_webhook_url ?? "",
              notifyOn: notif.notify_on,
            }
          : null
      }
    />
  );
}
