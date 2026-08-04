import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/project-card";
import { listProjectsWithLatestScan } from "@/lib/data/projects";

export default async function DashboardPage() {
  const projects = await listProjectsWithLatestScan();

  if (projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-prosa text-body text-fg">Nenhum projeto ligado.</p>
        <p className="font-prosa text-body text-fg-muted max-w-sm">
          Liga o teu projeto Supabase e recebes o primeiro relatório em menos de dois minutos.
        </p>
        <Link href="/app/projects/new">
          <Button variant="primary">Ligar projeto</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-display-l text-fg">Projetos</h1>
        <Link href="/app/projects/new">
          <Button variant="primary">+ ligar projeto</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
