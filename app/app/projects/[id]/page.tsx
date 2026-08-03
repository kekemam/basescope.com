import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScoreBar } from "@/components/score-bar";
import { Button } from "@/components/ui/button";
import { ScanButton } from "./scan-button";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, provider, connection_status, ownership_verified_at, current_score, last_scan_at, verified_domain")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: scans } = await supabase
    .from("scans")
    .select("id, status, score, findings_count, critical_count, high_count, medium_count, low_count, started_at, finished_at")
    .eq("project_id", id)
    .order("started_at", { ascending: false })
    .limit(10);

  const isVerified = Boolean(project.ownership_verified_at);

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between border-b border-rule pb-4 mb-6">
        <div>
          <h1 className="font-display text-display-l text-bone">{project.name}</h1>
          <p className="font-data text-body-sm text-graphite">{project.verified_domain ?? "sem domínio"}</p>
        </div>
        <div className="flex items-center gap-4">
          <ScoreBar score={project.current_score ?? 0} />
          {isVerified ? (
            <ScanButton projectId={project.id} />
          ) : (
            <Link href={`/app/projects/${project.id}/verify`}>
              <Button variant="primary">Verificar propriedade</Button>
            </Link>
          )}
        </div>
      </div>

      {!isVerified && (
        <p className="font-prosa text-body text-sev-med mb-6">
          Este projeto ainda não foi verificado — não é possível correr um scan até confirmares que és o dono.
        </p>
      )}

      <h2 className="font-data text-label uppercase tracking-[0.12em] text-graphite mb-2">Scans</h2>
      {scans && scans.length > 0 ? (
        <div className="flex flex-col">
          {scans.map((scan) => (
            <Link
              key={scan.id}
              href={`/app/projects/${project.id}/scans/${scan.id}`}
              className="flex items-center justify-between border-b border-rule py-3 hover:bg-hull-lift px-2 -mx-2"
            >
              <span className="font-data text-data text-bone">
                {scan.started_at ? new Date(scan.started_at).toISOString() : "—"}
              </span>
              <span className="font-data text-data text-graphite">{scan.status}</span>
              <span className="font-data text-data text-bone">{scan.findings_count} achados</span>
              <span className="font-data text-data text-bone">score {scan.score ?? "—"}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="font-prosa text-body text-graphite">Ainda não correu nenhum scan.</p>
      )}
    </div>
  );
}
