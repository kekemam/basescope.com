import Link from "next/link";
import { Logo } from "@/components/logo";
import { LegalFooter } from "@/components/legal-footer";

/** Shell partilhado pelas páginas públicas de /docs — mesmo padrão de components/legal-page.tsx. */
export function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-4 font-data text-data">
          <Link href="/docs" className="text-fg-muted hover:text-fg">
            Rule catalog
          </Link>
          <Link href="/tools/rls-validator" className="text-fg-muted hover:text-fg">
            RLS validator
          </Link>
          <Link href="/signup">
            <button className="inline-flex items-center justify-center rounded-sm font-data text-data transition-colors duration-[120ms] ease-out bg-accent text-bg hover:bg-accent/90 h-[30px] px-2">
              Free scan
            </button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <LegalFooter />
    </div>
  );
}
