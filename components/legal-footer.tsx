import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacidade" },
  { href: "/legal/terms", label: "Termos" },
  { href: "/legal/dpa", label: "DPA" },
  { href: "/legal/scan-authorization", label: "Scan Authorization Agreement" },
];

/** Obrigatório em toda a página da app e da landing — docs/design-system-v2.md § 11. */
export function LegalFooter() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-border">
      <p className="font-data text-body-sm text-fg-subtle">
        Basescope é um produto independente. Não é afiliado, patrocinado nem aprovado pela Supabase Inc.
        &quot;Supabase&quot; é marca registada da Supabase Inc.
      </p>
      <nav className="flex items-center gap-3 shrink-0">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="font-data text-body-sm text-fg-subtle hover:text-fg-muted">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
