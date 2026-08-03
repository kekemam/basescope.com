import Link from "next/link";
import { redirect } from "next/navigation";
import { ScoreBar } from "@/components/score-bar";
import { getCurrentUserEmail, listProjectsForCurrentUser } from "@/lib/data/projects";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await getCurrentUserEmail();
  if (!email) redirect("/login");

  const projects = await listProjectsForCurrentUser();

  return (
    <div className="mx-auto flex min-h-screen max-w-app border-x border-rule">
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-rule">
        <div className="border-b border-rule px-4 py-4">
          <span className="font-display text-display-l text-bone">BASESCOPE</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 font-data text-label uppercase tracking-[0.12em] text-graphite">Projetos</div>
          <nav className="flex flex-col">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/app/projects/${project.id}`}
                className="flex flex-col gap-1 px-4 py-2 hover:bg-hull-lift"
              >
                <span className="font-data text-data text-bone truncate">{project.name}</span>
                <ScoreBar score={project.current_score ?? 0} />
              </Link>
            ))}
          </nav>
          <Link
            href="/app/projects/new"
            className="block px-4 py-2 font-data text-data text-signal hover:bg-hull-lift"
          >
            + ligar
          </Link>
        </div>

        <div className="border-t border-rule">
          <Link href="/app/settings" className="block px-4 py-2 font-data text-data text-bone hover:bg-hull-lift">
            Definições
          </Link>
          <Link
            href="/app/settings/billing"
            className="block px-4 py-2 font-data text-data text-bone hover:bg-hull-lift"
          >
            Faturação
          </Link>
          <Link
            href="/app/settings/api-keys"
            className="block px-4 py-2 font-data text-data text-bone hover:bg-hull-lift"
          >
            Chaves API
          </Link>
        </div>
      </aside>

      <main className="flex-1">{children}</main>
    </div>
  );
}
