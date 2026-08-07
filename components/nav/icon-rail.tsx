"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderKanban, Clock, Settings, BookOpen, User, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

interface RailItem {
  href: string;
  icon: typeof Home;
  label: string;
}

const ITEMS: RailItem[] = [
  { href: "/app", icon: Home, label: "Visão geral" },
  { href: "/app/p", icon: FolderKanban, label: "Projetos" },
  { href: "/app/historico", icon: Clock, label: "Histórico" },
  { href: "/app/definicoes", icon: Settings, label: "Definições" },
  { href: "/docs", icon: BookOpen, label: "Documentação" },
];

function RailButton({ active, label, children, className }: { active?: boolean; label: string; children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          aria-label={label}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-md",
            active ? "bg-surface-2 text-accent" : "text-fg-muted hover:text-fg hover:bg-surface-2",
            className,
          )}
        >
          {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-accent" aria-hidden="true" />}
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Rail de 48px, sempre visível — ícones reais (lucide-react), não glifos unicode nem SVG à mão. */
export function IconRail() {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={300}>
      <nav className="flex w-16 shrink-0 flex-col items-center border-r border-border bg-bg py-4 gap-1">
        <Link href="/app" className="mb-4">
          <Logo withWordmark={false} />
        </Link>

        {ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <RailButton active={active} label={item.label}>
                <item.icon size={19} strokeWidth={1.75} />
              </RailButton>
            </Link>
          );
        })}

        <div className="flex-1" />

        <Link href="/app/definicoes">
          <RailButton label="Conta">
            <User size={19} strokeWidth={1.75} />
          </RailButton>
        </Link>
        <form action={signOut}>
          <button type="submit">
            <RailButton label="Sair">
              <LogOut size={19} strokeWidth={1.75} />
            </RailButton>
          </button>
        </form>
      </nav>
    </TooltipProvider>
  );
}
