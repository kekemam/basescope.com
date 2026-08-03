import { describe, expect, it } from "vitest";
import { rls003 } from "./rls-003";
import { createFakeSql, createTestContext } from "../test-utils";
import type { PgPolicyRow } from "./_shared";

function policy(overrides: Partial<PgPolicyRow>): PgPolicyRow {
  return {
    schemaname: "public",
    tablename: "orders",
    policyname: "orders_all",
    permissive: "PERMISSIVE",
    roles: ["authenticated"],
    cmd: "ALL",
    qual: "(auth.uid() = user_id)",
    with_check: "true",
    ...overrides,
  };
}

describe("RLS-003", () => {
  it("critical: exemplo do bug real — USING restritivo, WITH CHECK (true)", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[policy({})]]) });
    const findings = await rls003.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("NÃO reporta: FOR ALL com with_check null e qual restritivo (seguro)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[policy({ with_check: null })]]),
    });
    expect(await rls003.check(ctx)).toHaveLength(0);
  });

  it("NÃO reporta: FOR UPDATE com with_check null e qual restritivo (seguro)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[policy({ cmd: "UPDATE", with_check: null })]]),
    });
    expect(await rls003.check(ctx)).toHaveLength(0);
  });

  it("NÃO reporta: SELECT com with_check null (normal)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[policy({ cmd: "SELECT", qual: "(auth.uid() = user_id)", with_check: null })]]),
    });
    expect(await rls003.check(ctx)).toHaveLength(0);
  });

  it("critical: FOR INSERT sem WITH CHECK (dá true implícito)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[policy({ cmd: "INSERT", qual: null, with_check: null })]]),
    });
    expect(await rls003.check(ctx)).toHaveLength(1);
  });

  it("critical: divergência estrutural — USING usa auth.uid(), WITH CHECK não", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [policy({ qual: "(auth.uid() = user_id)", with_check: "(org_id = current_org())" })],
      ]),
    });
    expect(await rls003.check(ctx)).toHaveLength(1);
  });

  it("NÃO reporta: FOR ALL sem nenhuma proteção mas roles não inclui authenticated", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[policy({ roles: ["service_role"], with_check: null })]]),
    });
    expect(await rls003.check(ctx)).toHaveLength(0);
  });
});
