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

export interface ProjectCardData extends ProjectSummary {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/** Card da grelha de /app — inclui a contagem de severidade do último scan concluído. */
export async function listProjectsWithLatestScan(): Promise<ProjectCardData[]> {
  const supabase = await createClient();
  const projects = await listProjectsForCurrentUser();

  return Promise.all(
    projects.map(async (project) => {
      const { data: scan } = await supabase
        .from("scans")
        .select("critical_count, high_count, medium_count, low_count")
        .eq("project_id", project.id)
        .eq("status", "done")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...project,
        criticalCount: scan?.critical_count ?? 0,
        highCount: scan?.high_count ?? 0,
        mediumCount: scan?.medium_count ?? 0,
        lowCount: scan?.low_count ?? 0,
      };
    }),
  );
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
