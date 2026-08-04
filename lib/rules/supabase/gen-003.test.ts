import { describe, expect, it } from "vitest";
import { gen003 } from "./gen-003";
import { createFakeSql, createTestContext } from "../test-utils";

describe("GEN-003", () => {
  it("low quando a tabela com PII nunca foi lida (sem seq/idx scan)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "old_profiles", pii_columns: ["email"], last_seq_scan: null, last_idx_scan: null }],
      ]),
    });

    const findings = await gen003.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("low");
  });

  it("low quando o último acesso foi há mais de 90 dias", async () => {
    const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "old_profiles", pii_columns: ["email"], last_seq_scan: oldDate, last_idx_scan: null }],
      ]),
    });

    expect(await gen003.check(ctx)).toHaveLength(1);
  });

  it("sem finding quando a tabela foi acedida recentemente", async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "profiles", pii_columns: ["email"], last_seq_scan: recentDate, last_idx_scan: null }],
      ]),
    });

    expect(await gen003.check(ctx)).toHaveLength(0);
  });
});
