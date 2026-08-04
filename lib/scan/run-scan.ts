import type { Finding, Rule, ScanContext, Severity } from "../rules/types";
import { RULE_BATCHES } from "../rules/supabase";

/** Um scan tem de caber em 60s (maxDuration da function). Corta aos 45s para sobrar
 * margem de escrever o resultado parcial antes do hard timeout da plataforma. */
const TOTAL_BUDGET_MS = 45_000;

export interface ScanError {
  ruleId: string;
  message: string;
}

export interface ScanSummary {
  status: "done" | "partial";
  findings: Finding[];
  durationMs: number;
  /** Regras que não chegaram a correr por falta de tempo ou de pré-requisito (ex.: sem OAuth). */
  skippedRuleIds: string[];
  errors: ScanError[];
  score: number;
  counts: Record<Severity, number>;
}

/** Fórmula publicada na secção 6.4 do PROJECT_SPEC — reutilizada por "Verificar correções" (verify-fixes-action.ts) para recalcular o score sem correr o scan completo. */
export function computeScore(counts: Record<Severity, number>): number {
  const penalty = counts.critical * 20 + counts.high * 8 + counts.medium * 3 + counts.low * 1;
  return Math.max(0, 100 - penalty);
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

/**
 * Corre todas as regras da Fase 1 por lotes (rápidas primeiro), respeitando
 * o orçamento de 45s. Se o tempo esgotar a meio, marca `status: 'partial'`
 * e devolve os findings já obtidos em vez de falhar o scan inteiro — nunca
 * deixa o utilizador com zero informação (docs/rules-critical.md).
 */
export async function runScan(
  ctx: ScanContext,
  batches: Rule[][] = RULE_BATCHES,
  budgetMs: number = TOTAL_BUDGET_MS,
): Promise<ScanSummary> {
  const start = Date.now();
  const findings: Finding[] = [];
  const skippedRuleIds: string[] = [];
  const errors: ScanError[] = [];
  let status: "done" | "partial" = "done";

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]!;

    if (Date.now() - start > budgetMs) {
      status = "partial";
      for (let i = batchIndex; i < batches.length; i++) {
        skippedRuleIds.push(...batches[i]!.map((r) => r.id));
      }
      break;
    }

    const results = await Promise.allSettled(batch.map((rule) => rule.check(ctx)));
    results.forEach((result, i) => {
      const rule = batch[i]!;
      if (result.status === "fulfilled") {
        findings.push(...result.value);
      } else {
        status = "partial";
        errors.push({ ruleId: rule.id, message: String(result.reason) });
      }
    });
  }

  const counts = countBySeverity(findings);

  return {
    status,
    findings,
    durationMs: Date.now() - start,
    skippedRuleIds,
    errors,
    score: computeScore(counts),
    counts,
  };
}
