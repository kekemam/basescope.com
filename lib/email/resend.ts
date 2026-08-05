import "server-only";
import { Resend } from "resend";

// Temporário: basescope.com ainda não está comprado nem verificado no
// Resend. onboarding@resend.dev é o domínio sandbox — funciona sem
// verificação, mas só entrega no email da própria conta Resend. Troca
// para um domínio verificado (ex. notificacoes@basescope.com) assim que
// existir, antes de teres utilizadores a sério.
const FROM = "Basescope <onboarding@resend.dev>";

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não está definida");
  return new Resend(key);
}

function wrapper(bodyHtml: string): string {
  return `<div style="font-family:monospace;background:#131619;color:#ededed;padding:24px">
    <p style="color:#4c9ef5;font-weight:bold;margin-bottom:16px">BASESCOPE</p>
    ${bodyHtml}
  </div>`;
}

/**
 * As 4 mensagens da secção 6.3/10 do PROJECT_SPEC. Falhar a enviar um
 * email nunca deve rebentar o fluxo que o disparou (signup, scan,
 * webhook) — por isso cada função engole o próprio erro e devolve
 * silenciosamente, deixando só um log no servidor.
 */
async function sendSafely(to: string, subject: string, html: string) {
  try {
    await client().emails.send({ from: FROM, to, subject, html: wrapper(html) });
  } catch (err) {
    console.error("[email] falha ao enviar", subject, err instanceof Error ? err.message : err);
  }
}

export async function sendWelcomeEmail(to: string) {
  await sendSafely(
    to,
    "Bem-vindo ao Basescope",
    `<p>A tua conta está pronta. Liga o teu primeiro projeto Supabase e recebe o relatório em menos de 2 minutos.</p>`,
  );
}

export async function sendScanReadyEmail(to: string, projectName: string, score: number, criticalCount: number, reportUrl: string) {
  await sendSafely(
    to,
    `Relatório pronto: ${projectName}`,
    `<p>Score: ${score}/100${criticalCount > 0 ? ` · ${criticalCount} achado(s) crítico(s)` : ""}</p>
     <p><a href="${reportUrl}" style="color:#4c9ef5">Ver relatório completo →</a></p>`,
  );
}

export async function sendNewCriticalFindingEmail(to: string, projectName: string, ruleId: string, resourceName: string, reportUrl: string) {
  await sendSafely(
    to,
    `Novo achado crítico em ${projectName}`,
    `<p>${ruleId} em ${resourceName}.</p>
     <p><a href="${reportUrl}" style="color:#4c9ef5">Ver e corrigir →</a></p>`,
  );
}

export async function sendPaymentFailedEmail(to: string, billingUrl: string) {
  await sendSafely(
    to,
    "Falha no pagamento da tua subscrição Basescope",
    `<p>Não conseguimos cobrar o teu cartão. Atualiza o método de pagamento para não perderes acesso aos scans do teu plano.</p>
     <p><a href="${billingUrl}" style="color:#4c9ef5">Atualizar pagamento →</a></p>`,
  );
}
