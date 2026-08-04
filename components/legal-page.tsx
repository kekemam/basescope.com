import Link from "next/link";
import { Logo } from "@/components/logo";
import { LegalFooter } from "@/components/legal-footer";

/**
 * Não fui escrito nem revisto por um advogado — são rascunhos honestos,
 * ancorados no que o produto realmente faz (ver PROJECT_SPEC.md), mas
 * precisam de revisão jurídica antes de servirem de base a um contrato
 * real. Mesmo espírito do aviso já existente no PROJECT_SPEC sobre IVA:
 * "confirma com o teu contabilista antes da primeira fatura".
 */
function DraftNotice() {
  return (
    <div className="border border-med/40 bg-med/10 rounded-md px-4 py-3 mb-8">
      <p className="font-data text-body-sm text-med">
        Rascunho gerado a partir da especificação técnica do produto — revê com um advogado antes de tratares isto
        como vinculativo.
      </p>
    </div>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/">
          <Logo />
        </Link>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-display-xl text-fg mb-1">{title}</h1>
          <p className="font-data text-body-sm text-fg-subtle mb-8">Última atualização: {updated}</p>

          <DraftNotice />

          <div className="flex flex-col gap-6 font-prosa text-body text-fg-muted [&_h2]:font-data [&_h2]:text-data [&_h2]:uppercase [&_h2]:tracking-[0.08em] [&_h2]:text-fg [&_h2]:mt-4 [&_strong]:text-fg [&_a]:text-accent [&_a]:hover:underline">
            {children}
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
