import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SecondaryPanel, type NavSection } from "@/components/nav/secondary-panel";
import { ProjectBreadcrumbs } from "@/components/nav/project-breadcrumbs";
import { ProjectSwitcher } from "@/components/nav/project-switcher";
import { AccountMenu } from "@/components/nav/account-menu";
import { listProjectsForCurrentUser, getCurrentUserEmail } from "@/lib/data/projects";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("id, name, org_id, current_score").eq("id", id).single();
  if (!project) notFound();

  const { data: org } = await supabase.from("organizations").select("name").eq("id", project.org_id).maybeSingle();

  const [projects, email] = await Promise.all([listProjectsForCurrentUser(), getCurrentUserEmail()]);

  const sections: NavSection[] = [
    {
      title: "Relatório",
      items: [
        { href: `/app/p/${id}`, label: "Dashboard", icon: "dashboard" },
        { href: `/app/p/${id}/achados`, label: "Achados", icon: "achados" },
        { href: `/app/p/${id}/historico`, label: "Histórico", icon: "historico" },
        { href: `/app/p/${id}/regras`, label: "Regras", icon: "regras" },
      ],
    },
    {
      title: "Projeto",
      items: [{ href: `/app/p/${id}/definicoes`, label: "Definições", icon: "definicoes" }],
    },
    {
      title: "Organização",
      items: [
        { href: "/app/org/faturacao", label: "Faturação", icon: "faturacao" },
        { href: "/app/org/equipa", label: "Equipa", icon: "equipa" },
        { href: "/app/org/api", label: "Chaves API", icon: "api" },
      ],
    },
  ];

  return (
    <div className="flex h-full min-h-0">
      <SecondaryPanel sections={sections} />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-border px-4 shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <ProjectSwitcher projects={projects} current={projects.find((p) => p.id === id)} />
            <ProjectBreadcrumbs projectId={id} projectName={project.name} orgName={org?.name ?? "—"} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1 rounded-md border border-border-str bg-surface px-2 h-8 font-data text-body-sm text-fg-subtle">
              <kbd className="font-data">⌘</kbd>
              <kbd className="font-data">K</kbd>
            </div>
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-full text-fg-subtle hover:text-fg hover:bg-surface-2"
              aria-label="Ajuda"
            >
              ?
            </a>
            {email && <AccountMenu email={email} />}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
