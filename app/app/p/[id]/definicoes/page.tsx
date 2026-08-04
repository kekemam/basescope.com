import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DefinicoesView } from "./definicoes-view";

export default async function DefinicoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, connection_status, verified_domain")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const { data: notif } = await supabase
    .from("notification_settings")
    .select("email_enabled, slack_webhook_url, discord_webhook_url, notify_on")
    .eq("project_id", id)
    .maybeSingle();

  return (
    <DefinicoesView
      projectId={project.id}
      projectName={project.name}
      connectionStatus={project.connection_status}
      verifiedDomain={project.verified_domain}
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
