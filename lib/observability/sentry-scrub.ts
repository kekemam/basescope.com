import type { ErrorEvent } from "@sentry/nextjs";

// Padrões de segredo que nunca podem chegar ao Sentry (PROJECT_SPEC § 3:
// "Nunca em logs, nunca no Sentry (configura beforeSend para remover)").
// Aplica-se ao evento inteiro via stringify/replace — mais robusto a
// mudanças de forma do evento do Sentry do que percorrer campo a campo.
const SECRET_PATTERNS: RegExp[] = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT (service_role legacy, anon, user tokens)
  /sb_secret_[A-Za-z0-9_-]+/g, // service_role (formato novo)
  /sb_publishable_[A-Za-z0-9_-]+/g,
  /postgres(?:ql)?:\/\/[^\s"'<>]*/g, // connection string, inclui password
  /sk_(?:live|test)_[A-Za-z0-9]+/g, // Stripe secret key
  /whsec_[A-Za-z0-9]+/g, // Stripe webhook secret
  /re_[A-Za-z0-9_]+/g, // Resend API key
  /"authorization"\s*:\s*"[^"]*"/gi,
  /"apikey"\s*:\s*"[^"]*"/gi,
  /"cookie"\s*:\s*"[^"]*"/gi,
];

export function scrubSecrets(event: ErrorEvent): ErrorEvent {
  let serialized: string;
  try {
    serialized = JSON.stringify(event);
  } catch {
    return event;
  }

  for (const pattern of SECRET_PATTERNS) {
    serialized = serialized.replace(pattern, "[REDACTED]");
  }

  try {
    return JSON.parse(serialized) as ErrorEvent;
  } catch {
    return event;
  }
}
