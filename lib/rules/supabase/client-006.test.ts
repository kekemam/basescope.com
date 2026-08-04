import { describe, expect, it } from "vitest";
import { client006 } from "./client-006";
import { createFakeSql, createTestContext } from "../test-utils";

describe("CLIENT-006", () => {
  it("high quando há tabelas legíveis por anon", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[{ table_name: "profiles" }, { table_name: "products" }]]),
    });
    const findings = await client006.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
    expect(findings[0]?.evidence.anon_readable_table_count).toBe(2);
  });

  it("sem findings quando nenhuma tabela é legível por anon", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[]]) });
    expect(await client006.check(ctx)).toHaveLength(0);
  });
});
