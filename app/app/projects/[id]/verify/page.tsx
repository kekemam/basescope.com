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
      <h1 className="font-display text-display-l text-bone mb-1">Verificar propriedade</h1>
      <p className="font-prosa text-body text-graphite mb-6">
        Antes do primeiro scan de <strong className="text-bone">{project.name}</strong>, precisamos de confirmar que
        és o dono deste domínio.
      </p>

      <ol className="flex flex-col gap-4 mb-8">
        <li className="font-prosa text-body text-bone">
          1. Cria um ficheiro em{" "}
          <code className="font-data text-data text-signal break-all">{fileUrl}</code>
        </li>
        <li className="font-prosa text-body text-bone">
          2. Com este conteúdo exato:
          <pre className="mt-2 border border-rule bg-hull p-3 font-data text-data text-bone overflow-x-auto">
            {fileContent}
          </pre>
        </li>
        <li className="font-prosa text-body text-bone">3. Aceita o agreement abaixo e confirma.</li>
      </ol>

      <VerifyForm action={boundAction} />
    </div>
  );
}
