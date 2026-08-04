import Link from "next/link";
import { ScoreBar } from "@/components/score-bar";
import type { ProjectCardData } from "@/lib/data/projects";

export function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <Link
      href={`/app/p/${project.id}`}
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 hover:border-border-str"
    >
      <div className="flex items-center justify-between">
        <span className="font-data text-data text-fg truncate">{project.name}</span>
        <ScoreBar score={project.current_score ?? 0} />
      </div>

      <div className="flex gap-4 font-data text-body-sm">
        <span className="text-crit">████ {project.criticalCount}</span>
        <span className="text-high">███░ {project.highCount}</span>
        <span className="text-med">██░░ {project.mediumCount}</span>
        <span className="text-low">█░░░ {project.lowCount}</span>
      </div>

      <span className="font-data text-body-sm text-fg-subtle">
        {project.last_scan_at ? `último scan ${new Date(project.last_scan_at).toLocaleDateString("pt-PT")}` : "sem scans ainda"}
      </span>
    </Link>
  );
}
