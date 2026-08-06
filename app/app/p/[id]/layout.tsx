import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SecondaryPanel, type NavSection } from "@/components/nav/secondary-panel";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { ProjectSwitcher } from "@/components/nav/project-switcher";
import { Tabs } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { listProjectsForCurrentUser } from "@/lib/data/projects";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("id, name, current_score").eq("id", id).single();
  if (!project) notFound();

  const projects = await listProjectsForCurrentUser();

  const sections: NavSection[] = [
    {
      title: "Projeto",
      items: [
        { href: `/app/p/${id}/achados`, label: "Achados" },
        { href: `/app/p/${id}/historico`, label: "Histórico" },
        { href: `/app/p/${id}/regras`, label: "Regras" },
        { href: `/app/p/${id}/definicoes`, label: "Definições" },
      ],
    },
    {
      title: "Organização",
      items: [
        { href: "/app/org/faturacao", label: "Faturação" },
        { href: "/app/org/equipa", label: "Equipa" },
        { href: "/app/org/api", label: "Chaves API" },
      ],
    },
  ];

  const tabs = [
    { href: `/app/p/${id}`, label: "Dashboard" },
    { href: `/app/p/${id}/achados`, label: "Achados" },
    { href: `/app/p/${id}/historico`, label: "Histórico" },
    { href: `/app/p/${id}/regras`, label: "Regras" },
    { href: `/app/p/${id}/definicoes`, label: "Definições" },
  ];

  return (
    <div className="flex h-full min-h-0">
      <SecondaryPanel sections={sections} />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-12 items-center justify-between border-b border-border px-4 shrink-0">
          <Breadcrumbs
            items={[
              { label: "Projetos", href: "/app" },
              { label: project.name, href: `/app/p/${id}` },
              { label: "Relatório" },
            ]}
          />
          <div className="flex items-center gap-3">
            <ProjectSwitcher projects={projects} current={projects.find((p) => p.id === id)} />
            <span className="font-data text-body-sm text-fg-subtle">⌘K</span>
            <ThemeToggle />
          </div>
        </header>
        <Tabs items={tabs} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
