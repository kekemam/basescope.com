import { describe, expect, it } from "vitest";
import { pii001 } from "./pii-001";
import { createFakeSql, createTestContext } from "../test-utils";

describe("PII-001", () => {
  it("critical quando há colunas PII e RLS desativado", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "profiles", relrowsecurity: false, pii_columns: ["email", "phone"] }],
      ]),
    });

    const findings = await pii001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
    expect(findings[0]?.evidence.pii_columns).toEqual(["email", "phone"]);
  });

  it("sem finding quando RLS está ativo", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[{ table_name: "profiles", relrowsecurity: true, pii_columns: ["email"] }]]),
    });

    expect(await pii001.check(ctx)).toHaveLength(0);
  });

  it("sem finding quando não há tabelas com colunas PII", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[]]) });
    expect(await pii001.check(ctx)).toHaveLength(0);
  });
});
