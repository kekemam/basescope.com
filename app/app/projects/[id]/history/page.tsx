import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScoreHistoryChart, type ScorePoint } from "@/components/score-history-chart";

export default async function ProjectHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).single();
  if (!project) notFound();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: scans } = await supabase
    .from("scans")
    .select("score, started_at")
    .eq("project_id", id)
    .eq("status", "done")
    .gte("started_at", thirtyDaysAgo)
    .not("score", "is", null)
    .order("started_at", { ascending: true });

  const points: ScorePoint[] = (scans ?? [])
    .filter((s) => s.started_at && s.score !== null)
    .map((s) => ({ date: s.started_at as string, score: s.score as number }));

  const variation = points.length >= 2 ? points[points.length - 1]!.score - points[points.length - 2]!.score : null;

  return (
    <div className="px-6 py-6">
      <h1 className="font-display text-display-l text-bone mb-1">Histórico — {project.name}</h1>
      <p className="font-prosa text-body text-graphite mb-6">
        Score dos últimos 30 dias.
        {variation !== null && (
          <span className={variation >= 0 ? " text-sev-ok" : " text-sev-crit"}>
            {" "}
            ({variation >= 0 ? "+" : ""}
            {variation} face ao scan anterior)
          </span>
        )}
      </p>

      <ScoreHistoryChart points={points} />
    </div>
  );
}
