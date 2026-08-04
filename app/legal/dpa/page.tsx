import { LegalPage } from "@/components/legal-page";

export default function DpaPage() {
  return (
    <LegalPage title="Acordo de Processamento de Dados (DPA)" updated="4 de agosto de 2026">
      <p>
        Este acordo aplica-se quando processamos dados pessoais em teu nome como subcontratante (RGPD, art. 28.º) —
        relevante sobretudo se o teu projeto Supabase contém dados pessoais de utilizadores finais teus.
      </p>

      <h2>1. Papéis</h2>
      <p>
        Tu és o responsável pelo tratamento dos dados dos teus utilizadores finais. O Basescope é subcontratante:
        processamos metadados de configuração da tua base de dados por tua instrução, para o efeito específico de
        deteção de falhas de segurança.
      </p>

      <h2>2. Objeto e natureza do processamento</h2>
      <p>
        Leitura de metadados do catálogo Postgres (nomes de tabelas/colunas/políticas) e contagens de linhas
        visíveis a acesso anónimo. Nunca o conteúdo das linhas. Ver a{" "}
        <a href="/legal/privacy">Política de Privacidade</a> para o detalhe técnico de como isto é garantido.
      </p>

      <h2>3. Deteção de dados pessoais nas tuas tabelas</h2>
      <p>
        Uma das regras do motor de scan (PII-001) deteta, por nome de coluna, tabelas que provavelmente contêm dados
        pessoais (email, telefone, morada, IBAN, NIF, data de nascimento, etc.) sem proteção adequada. Esta deteção é
        heurística — por nome, nunca por amostragem de valores — e serve para te alertar, não para nos dar acesso a
        esses dados.
      </p>
      <p>
        Se um scan confirmar que uma tabela com estas colunas esteve acessível publicamente, isso pode acionar a tua
        obrigação de notificação à autoridade de controlo no prazo de 72 horas (RGPD, art. 33.º). O relatório
        assinala isto explicitamente, mas a decisão e a notificação são tuas — recomendamos que confirmes com um
        advogado ou o teu encarregado de proteção de dados.
      </p>

      <h2>4. Subcontratantes ulteriores</h2>
      <p>Supabase (base de dados própria do Basescope), Vercel (hosting), Resend (email).</p>

      <h2>5. Segurança</h2>
      <p>
        RLS ativo em todas as tabelas da nossa base de dados própria, credenciais encriptadas com AES-256-GCM,
        <code>search_path</code> fixo em todas as funções <code>SECURITY DEFINER</code>, sem source maps em
        produção. Detalhe completo na <a href="/legal/privacy">Política de Privacidade</a>.
      </p>

      <h2>6. Retenção e apagamento</h2>
      <p>
        Credenciais apagadas imediatamente após revogação ou cancelamento. Achados e histórico retidos 90 dias após
        o cancelamento, depois apagados de forma irreversível.
      </p>
    </LegalPage>
  );
}
