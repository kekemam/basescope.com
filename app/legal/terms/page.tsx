import { LegalPage } from "@/components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Serviço" updated="4 de agosto de 2026">
      <h2>1. O serviço</h2>
      <p>
        O Basescope liga-se a projetos Supabase (e, no futuro, Firebase) que autorizes explicitamente, deteta falhas
        de configuração de segurança, e devolve o SQL para as corrigir. Não é um teste de intrusão nem um scanner de
        dependências — é especificamente auditoria de configuração de backend-as-a-service.
      </p>

      <h2>2. A tua responsabilidade</h2>
      <p>
        Só podes ligar projetos dos quais és proprietário ou tens autorização explícita do proprietário. Aceitar o{" "}
        <a href="/legal/scan-authorization">Scan Authorization Agreement</a> sem essa autorização é uma violação
        destes termos e, dependendo da jurisdição, pode constituir crime — ver esse acordo para detalhe.
      </p>

      <h2>3. Planos e faturação</h2>
      <p>
        O plano Free está disponível sem custo, com os limites indicados na página de preços. Os restantes planos
        ainda não estão em vigor — quando estiverem, serão processados via Stripe, com faturação recorrente e
        possibilidade de cancelamento a qualquer momento no Customer Portal, sem período de fidelização.
      </p>

      <h2>4. Isenção de garantia</h2>
      <p>
        O Basescope deteta uma lista publicada de padrões de configuração conhecidos como perigosos. Não garantimos
        deteção de 100% dos problemas de segurança possíveis, nem que a ausência de achados significa ausência de
        risco. É uma ferramenta de auditoria, não um substituto de revisão de segurança profissional para
        aplicações de alto risco.
      </p>

      <h2>5. Limitação de responsabilidade</h2>
      <p>
        Na máxima medida permitida por lei, o Basescope não é responsável por danos indiretos decorrentes do uso do
        serviço, incluindo mas não limitado a perda de dados no teu projeto Supabase causada pela aplicação do SQL de
        remediação sugerido — recomendamos sempre testar em ambiente de staging antes de aplicar em produção.
      </p>

      <h2>6. Terminação</h2>
      <p>
        Podes cancelar a qualquer momento. Reservamo-nos o direito de suspender contas que usem o serviço para
        varrer projetos sem autorização verificada — essa é a linha vermelha inegociável do produto.
      </p>

      <h2>7. Lei aplicável</h2>
      <p>Lei portuguesa. Foro competente: comarca da sede do Basescope.</p>
    </LegalPage>
  );
}
