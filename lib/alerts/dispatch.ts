import "server-only";

async function postWebhook(url: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("[alerts] webhook respondeu", res.status, url);
  } catch (err) {
    // Um webhook mal configurado (URL apagada, canal removido) nunca deve
    // rebentar o fluxo de scan que o disparou — mesma regra do lib/email/resend.ts.
    console.error("[alerts] falha ao enviar webhook", err instanceof Error ? err.message : err);
  }
}

export async function sendSlackAlert(webhookUrl: string, text: string): Promise<void> {
  await postWebhook(webhookUrl, { text });
}

export async function sendDiscordAlert(webhookUrl: string, text: string): Promise<void> {
  await postWebhook(webhookUrl, { content: text });
}
