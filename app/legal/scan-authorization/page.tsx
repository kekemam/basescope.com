import { LegalPage } from "@/components/legal-page";

export default function ScanAuthorizationPage() {
  return (
    <LegalPage title="Scan Authorization Agreement" updated="4 de agosto de 2026">
      <p>
        Este acordo é o que aceitas, com timestamp e IP registados em base de dados, antes do primeiro scan de cada
        projeto. Sem este registo, o motor de scan recusa-se a correr — é uma verificação técnica, não só uma
        formalidade.
      </p>

      <h2>1. O que estás a autorizar</h2>
      <p>
        Autorizas o Basescope a ligar-se ao projeto Supabase que identificaste, usando as credenciais que forneceste,
        para:
      </p>
      <ul className="list-disc pl-5 flex flex-col gap-1">
        <li>Consultar o catálogo do Postgres (<code>pg_class</code>, <code>pg_policies</code>, <code>pg_proc</code>) — estrutura da base de dados, nunca o conteúdo das tabelas.</li>
        <li>Fazer pedidos <code>HEAD</code> (nunca <code>GET</code>) contra o PostgREST do teu projeto, para confirmar se um utilizador anónimo consegue ler linhas — sem nunca receber o conteúdo dessas linhas.</li>
        <li>Se tiveres verificado um domínio, descarregar a página inicial e os bundles JS publicamente servidos por esse domínio, à procura de chaves e segredos expostos.</li>
        <li>Repetir estas verificações nos scans seguintes que autorizares (manuais ou, em planos pagos, agendados).</li>
      </ul>

      <h2>2. O que declaras</h2>
      <p>
        Declaras que és o proprietário ou tens autorização do proprietário do projeto identificado, e que a
        verificação de propriedade que completaste (ficheiro <code>.well-known</code> ou OAuth) é genuína. O
        Basescope não descobre nem varre projetos que não tenhas verificado explicitamente — ver secção 0 do
        PROJECT_SPEC do produto.
      </p>

      <h2>3. O que fica registado</h2>
      <p>
        Ao aceitar, gravamos: o teu ID de utilizador, o projeto, a data e hora, o teu endereço IP, e a versão deste
        acordo. Este registo nunca é apagado enquanto o projeto existir, mesmo que revogues as credenciais depois.
      </p>

      <h2>4. Enquadramento legal</h2>
      <p>
        Aceder a sistemas informáticos sem autorização do proprietário é crime público em Portugal (Lei n.º
        109/2009, Lei do Cibercrime, artigos 6.º e 7.º). Este acordo existe para deixar ao teu cuidado, de forma
        explícita e registada, a prova de que a autorização existe.
      </p>

      <h2>5. Revogação</h2>
      <p>
        Podes revogar o acesso a qualquer momento em Definições → Credenciais → &quot;Revogar e apagar
        credenciais&quot;. Isto apaga a connection string e a anon key guardadas imediatamente; o registo de que
        aceitaste este acordo mantém-se, pelo motivo da secção 3.
      </p>
    </LegalPage>
  );
}
