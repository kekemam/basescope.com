import { createClient } from "@/lib/supabase/server";

export interface ProjectSummary {
  id: string;
  name: string;
  current_score: number | null;
  connection_status: string;
  last_scan_at: string | null;
}

export async function listProjectsForCurrentUser(): Promise<ProjectSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, current_score, connection_status, last_scan_at")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, provider, region, connection_status, ownership_verified_at, verification_method, current_score, last_scan_at, created_at")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}
