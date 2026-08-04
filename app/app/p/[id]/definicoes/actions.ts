"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Endpoint de 1 clique exigido pela secção 3 do PROJECT_SPEC: revoga e apaga as credenciais imediatamente. */
export async function revokeCredentials(projectId: string) {
  const admin = createAdminClient();
  await admin
    .from("projects")
    .update({ encrypted_credentials: null, connection_status: "revoked" })
    .eq("id", projectId);
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
  redirect("/app");
}

export interface NotificationSettingsInput {
  emailEnabled: boolean;
  slackWebhookUrl: string;
  discordWebhookUrl: string;
  notifyOn: "all" | "high_and_above" | "critical_only";
}

export async function saveNotificationSettings(projectId: string, input: NotificationSettingsInput) {
  const supabase = await createClient();
  await supabase.from("notification_settings").upsert(
    {
      project_id: projectId,
      email_enabled: input.emailEnabled,
      slack_webhook_url: input.slackWebhookUrl || null,
      discord_webhook_url: input.discordWebhookUrl || null,
      notify_on: input.notifyOn,
    },
    { onConflict: "project_id" },
  );
}
