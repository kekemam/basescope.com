import { describe, expect, it } from "vitest";
import { runScan } from "./run-scan";
import type { Finding, Rule } from "../rules/types";
import { createFakeSql, createTestContext } from "../rules/test-utils";

function fakeRule(id: string, findings: Finding[] = [], opts: { delayMs?: number; throws?: boolean } = {}): Rule {
  return {
    id,
    title: id,
    severity: "medium",
    category: "test",
    async check() {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.throws) throw new Error(`${id} falhou`);
      return findings;
    },
  };
}

function critFinding(ruleId: string, severity: Finding["severity"] = "critical"): Finding {
  return {
    ruleId,
    severity,
    resourceType: "table",
    resourceName: "public.x",
    title: "x",
    description: "x",
    evidence: {},
    remediationSql: null,
    remediationSteps: [],
    docsUrl: "https://basescope.com/docs/rules/x",
  };
}

describe("runScan", () => {
  it("agrega findings de todos os lotes e calcula o score", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]) });
    const batches: Rule[][] = [
      [fakeRule("A", [critFinding("A", "critical")])],
      [fakeRule("B", [critFinding("B", "high")])],
    ];

    const result = await runScan(ctx, batches);

    expect(result.status).toBe("done");
    expect(result.findings).toHaveLength(2);
    expect(result.counts).toEqual({ critical: 1, high: 1, medium: 0, low: 0 });
    expect(result.score).toBe(100 - 20 - 8);
  });

  it("marca status partial e regista o erro quando uma regra falha, sem abortar as outras", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]) });
    const batches: Rule[][] = [[fakeRule("A", [], { throws: true }), fakeRule("B", [critFinding("B")])]];

    const result = await runScan(ctx, batches);

    expect(result.status).toBe("partial");
    expect(result.errors).toEqual([{ ruleId: "A", message: "Error: A falhou" }]);
    expect(result.findings).toHaveLength(1);
  });

  it("corta lotes restantes quando o orçamento de tempo esgota", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]) });
    const batches: Rule[][] = [
      [fakeRule("slow", [], { delayMs: 30 })],
      [fakeRule("never-runs", [critFinding("never-runs")])],
    ];

    const result = await runScan(ctx, batches, 10);

    expect(result.status).toBe("partial");
    expect(result.skippedRuleIds).toEqual(["never-runs"]);
    expect(result.findings).toHaveLength(0);
  });

  it("score nunca desce abaixo de 0", async () => {
    const ctx = createTestContext({ admin: createFakeSql([]) });
    const manyFindings = Array.from({ length: 10 }, (_, i) => critFinding(`R${i}`, "critical"));
    const batches: Rule[][] = [[fakeRule("A", manyFindings)]];

    const result = await runScan(ctx, batches);
    expect(result.score).toBe(0);
  });
});
