import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScoreHistoryChart, type ScorePoint } from "@/components/score-history-chart";
import { EmptyState } from "@/components/ui/empty-state";

export default async function HistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).single();
  if (!project) notFound();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: scans } = await supabase
    .from("scans")
    .select("id, status, score, findings_count, critical_count, high_count, medium_count, low_count, started_at")
    .eq("project_id", id)
    .order("started_at", { ascending: false })
    .limit(30);

  const points: ScorePoint[] = (scans ?? [])
    .filter((s) => s.status === "done" && s.score !== null && s.started_at && s.started_at >= thirtyDaysAgo)
    .map((s) => ({ date: s.started_at as string, score: s.score as number }))
    .reverse();

  const variation = points.length >= 2 ? points[points.length - 1]!.score - points[points.length - 2]!.score : null;

  return (
    <div className="px-6 py-6 flex flex-col gap-8">
      <div>
        <p className="font-prosa text-body text-fg-muted mb-1">
          Score dos últimos 30 dias.
          {variation !== null && (
            <span className={variation >= 0 ? " text-ok" : " text-crit"}>
              {" "}
              ({variation >= 0 ? "+" : ""}
              {variation} face ao scan anterior)
            </span>
          )}
        </p>
        <ScoreHistoryChart points={points} />
      </div>

      <div>
        <h2 className="font-data text-label uppercase tracking-[0.08em] text-fg-subtle mb-2">Scans</h2>
        {scans && scans.length > 0 ? (
          <table className="w-full border-collapse font-data text-data">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 h-9 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Data</th>
                <th className="text-left px-3 h-9 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Estado</th>
                <th className="text-left px-3 h-9 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Achados</th>
                <th className="text-left px-3 h-9 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Score</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="h-9 border-b border-border hover:bg-surface-2">
                  <td className="px-3 text-fg">{scan.started_at ? new Date(scan.started_at).toISOString() : "—"}</td>
                  <td className="px-3 text-fg-muted">{scan.status}</td>
                  <td className="px-3 text-fg">{scan.findings_count}</td>
                  <td className="px-3 text-fg">{scan.score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="Ainda não correu nenhum scan." />
        )}
      </div>
    </div>
  );
}
