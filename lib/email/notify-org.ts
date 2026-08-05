import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Email do dono da organização de um projeto — usado para as notificações transacionais (scan pronto, novo crítico, falha de pagamento). */
export async function getProjectOwnerEmail(projectId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: project } = await admin.from("projects").select("org_id").eq("id", projectId).single();
  if (!project) return null;

  const { data: membership } = await admin
    .from("memberships")
    .select("user_id")
    .eq("org_id", project.org_id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const { data: userData } = await admin.auth.admin.getUserById(membership.user_id);
  return userData?.user?.email ?? null;
}
