import { redirect } from "next/navigation";
import { IconRail } from "@/components/nav/icon-rail";
import { LegalFooter } from "@/components/legal-footer";
import { CommandMenu } from "@/components/command-menu";
import { ShortcutsOverlay } from "@/components/shortcuts-overlay";
import { Toaster } from "@/components/ui/toaster";
import { getCurrentUserEmail, listProjectsForCurrentUser } from "@/lib/data/projects";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await getCurrentUserEmail();
  if (!email) redirect("/login");

  const projects = await listProjectsForCurrentUser();

  return (
    <div className="flex min-h-screen bg-bg">
      <IconRail />
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex-1 min-h-0">{children}</div>
        <LegalFooter />
      </div>
      <CommandMenu projects={projects} />
      <ShortcutsOverlay />
      <Toaster />
    </div>
  );
}
