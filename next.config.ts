import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
};

// O plugin do Sentry gera source maps privadas só para o upload (não
// publica-as — deleteSourcemapsAfterUpload garante isso), depois apaga-as
// do build de saída; productionBrowserSourceMaps continua false (CLIENT-003).
// Sem SENTRY_AUTH_TOKEN definido, o upload é ignorado (aviso, não falha o
// build) — é o estado atual até termos um DSN real.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  webpack: { treeshake: { removeDebugLogging: true }, automaticVercelMonitors: false },
});
