import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verificationTokenForProject } from "@/lib/crypto/encrypt";
import { verifyOwnership } from "./actions";
import { VerifyForm } from "./verify-form";

export default async function VerifyProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, verified_domain, ownership_verified_at")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const token = verificationTokenForProject(project.id);
  const fileContent = `basescope-verification=${token}`;
  const fileUrl = `https://${project.verified_domain}/.well-known/basescope-verification.txt`;
  const boundAction = verifyOwnership.bind(null, project.id);

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="font-display text-display-l text-fg mb-1">Verificar propriedade</h1>
      <p className="font-prosa text-body text-fg-muted mb-6">
        Antes do primeiro scan de <strong className="text-fg">{project.name}</strong>, precisamos de confirmar que
        és o dono deste domínio.
      </p>

      <ol className="flex flex-col gap-4 mb-8">
        <li className="font-prosa text-body text-fg">
          1. Cria um ficheiro em{" "}
          <code className="font-data text-data text-accent break-all">{fileUrl}</code>
        </li>
        <li className="font-prosa text-body text-fg">
          2. Com este conteúdo exato:
          <pre className="mt-2 border border-border bg-surface p-3 font-data text-data text-fg overflow-x-auto rounded-md">
            {fileContent}
          </pre>
        </li>
        <li className="font-prosa text-body text-fg">3. Aceita o agreement abaixo e confirma.</li>
      </ol>

      <VerifyForm action={boundAction} />
    </div>
  );
}
