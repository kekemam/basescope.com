import type postgres from "postgres";

export type Severity = "critical" | "high" | "medium" | "low";

export type ResourceType =
  | "table"
  | "policy"
  | "function"
  | "bucket"
  | "auth"
  | "config"
  | "client"
  | "edge_function";

/**
 * Resultado de uma sonda HEAD ao PostgREST com a anon key — nunca devolve
 * corpo, só o `Content-Range` (contagem de linhas visíveis ao anónimo).
 */
export interface AnonRestClient {
  headCount(table: string): Promise<{ status: number; totalCount: number | null }>;
  headStorageObject(bucket: string, path: string): Promise<{ status: number; contentLength: number | null }>;
}

export interface ScanContext {
  /** Ligação Postgres direta (connection string do pooler, ver secção de onboarding). Só leitura de catálogo. */
  admin: postgres.Sql;
  anonRest: AnonRestClient;
  projectRef: string;
  /** Domínio verificado pelo utilizador — só as regras CLIENT-* correm quando presente. */
  verifiedDomain: string | null;
  /** Token da Management API — só presente se a ligação foi por OAuth. */
  mgmtToken: string | null;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  resourceType: ResourceType;
  resourceName: string;
  title: string;
  description: string;
  /** Nomes de tabelas/colunas/políticas, contagens, expressões. NUNCA valores de linhas. */
  evidence: Record<string, unknown>;
  remediationSql: string | null;
  remediationSteps: string[];
  docsUrl: string;
}

export interface Rule {
  id: string;
  title: string;
  /** Severidade de referência para o catálogo (/docs/rules/[ruleId]) — cada Finding tem a sua própria. */
  severity: Severity | "info";
  category: string;
  check(ctx: ScanContext): Promise<Finding[]>;
}

export function docsUrlFor(ruleId: string): string {
  return `https://basescope.com/docs/rules/${ruleId.toLowerCase()}`;
}
