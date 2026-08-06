import * as Sentry from "@sentry/nextjs";
import { scrubSecrets } from "@/lib/observability/sentry-scrub";

// Carregado automaticamente pelo Next.js (App Router, Next 15.3+) — nunca é
// importado manualmente. O client não tem service_role/connection strings
// em memória, mas o scrub aplica-se na mesma por defesa em profundidade.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: scrubSecrets,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
