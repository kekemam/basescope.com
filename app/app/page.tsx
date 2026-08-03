import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listProjectsForCurrentUser } from "@/lib/data/projects";

export default async function DashboardPage() {
  const projects = await listProjectsForCurrentUser();

  if (projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-prosa text-body text-bone">Nenhum projeto ligado.</p>
        <p className="font-prosa text-body text-graphite max-w-sm">
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
      <h1 className="font-display text-display-l text-bone mb-4">Projetos</h1>
      <p className="font-prosa text-body text-graphite">
        Seleciona um projeto no rail à esquerda para ver o relatório mais recente.
      </p>
    </div>
  );
}
