import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/components/docs-shell";
import { RlsValidatorView } from "./rls-validator-view";

export const metadata: Metadata = {
  title: "Free Supabase RLS policy validator — Basescope",
  description:
    "Paste a Supabase Row Level Security policy and check it for common holes — USING (true), missing WITH CHECK, header-based identity. Free, no login, nothing sent to a server.",
};

export default function RlsValidatorPage() {
  return (
    <DocsShell>
      <section className="px-6 py-16 max-w-2xl mx-auto text-center flex flex-col items-center gap-4">
        <h1 className="font-display text-display-xl text-fg">RLS policy validator</h1>
        <p className="font-prosa text-body text-fg-muted max-w-xl">
          Paste a Supabase <code className="font-data text-fg">create policy</code> statement below. Free, no login,
          nothing is sent anywhere — this only checks the policy text you paste, not your actual database.
        </p>
      </section>

      <section className="px-6 pb-20 max-w-2xl mx-auto">
        <RlsValidatorView />

        <div className="mt-10 border-t border-border pt-6 text-center">
          <p className="font-prosa text-body-sm text-fg-muted mb-3">
            This only reads the text you paste — it can&apos;t see WITH CHECK vs. USING mismatches that depend on
            your actual schema, or confirm whether a table is really reachable by anon. Basescope does that against
            your real project.
          </p>
          <Link href="/signup">
            <button className="inline-flex items-center justify-center rounded-sm font-data text-data transition-colors duration-[120ms] ease-out bg-accent text-bg hover:bg-accent/90 h-[34px] px-3">
              Scan your real project free →
            </button>
          </Link>
        </div>
      </section>
    </DocsShell>
  );
}
