import { LegalPage } from "@/components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updated="4 de agosto de 2026">
      <h2>1. Quem trata os teus dados</h2>
      <p>Basescope, sediado em Portugal. Contacto: privacidade@basescope.com.</p>

      <h2>2. O que recolhemos de ti</h2>
      <ul className="list-disc pl-5 flex flex-col gap-1">
        <li>Email, para autenticação (magic link) e comunicações sobre a tua conta.</li>
        <li>Nome da organização, projeto ligado, e domínio verificado.</li>
        <li>IP e user agent no momento em que aceitas o Scan Authorization Agreement.</li>
        <li>Dados de faturação, quando existirem planos pagos ativos (processados pelo Stripe, não guardados por nós).</li>
      </ul>

      <h2>3. O que recolhemos do teu projeto Supabase — e o que não recolhemos</h2>
      <p>
        Recolhemos <strong>metadados de configuração</strong>: nomes de tabelas, colunas, políticas, funções,
        buckets, e a contagem de linhas visíveis a um utilizador anónimo. <strong>Nunca lemos o conteúdo das tuas
        tabelas.</strong> O teste de exposição usa pedidos <code>HEAD</code>, que por desenho do protocolo HTTP não
        têm corpo de resposta — não é uma promessa de comportamento, é uma escolha técnica que torna impossível
        recebermos os dados mesmo que quiséssemos.
      </p>

      <h2>4. Credenciais</h2>
      <p>
        A connection string e a anon key do teu projeto são encriptadas com AES-256-GCM antes de serem guardadas, com
        uma chave que só existe como variável de ambiente do servidor, nunca no repositório de código. São
        desencriptadas apenas dentro do processo que corre o scan, nunca numa função que responda ao browser, e nunca
        aparecem em logs.
      </p>

      <h2>5. Quanto tempo guardamos</h2>
      <ul className="list-disc pl-5 flex flex-col gap-1">
        <li>Credenciais: até revogares (1 clique) ou cancelares — apagadas imediatamente em qualquer dos casos.</li>
        <li>Achados e histórico de scans: 90 dias após o cancelamento da conta, depois apagados.</li>
        <li>Registo do Scan Authorization Agreement (IP, timestamp): mantido enquanto o projeto existir, por ser prova de autorização — ver o próprio acordo.</li>
      </ul>

      <h2>6. Com quem partilhamos</h2>
      <p>
        Supabase (a nossa própria base de dados, não a tua), Vercel (hosting), Stripe (pagamentos, quando aplicável),
        Resend (emails). Nenhum destes fornecedores recebe as tuas credenciais Supabase em claro.
      </p>

      <h2>7. Os teus direitos (RGPD)</h2>
      <p>
        Acesso, retificação, apagamento e portabilidade dos teus dados. Para exerceres qualquer um destes direitos,
        contacta privacidade@basescope.com. Podes apagar a tua conta e credenciais diretamente em Definições, sem
        precisares de nos contactar.
      </p>
    </LegalPage>
  );
}
