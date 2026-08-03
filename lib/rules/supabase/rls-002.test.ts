import { describe, expect, it } from "vitest";
import { rls002 } from "./rls-002";
import { createFakeSql, createTestContext } from "../test-utils";
import type { PgPolicyRow } from "./_shared";

function policy(overrides: Partial<PgPolicyRow>): PgPolicyRow {
  return {
    schemaname: "public",
    tablename: "orders",
    policyname: "orders_open",
    permissive: "PERMISSIVE",
    roles: ["anon"],
    cmd: "SELECT",
    qual: "true",
    with_check: null,
    ...overrides,
  };
}

describe("RLS-002", () => {
  it("critical para USING (true) em SELECT para anon", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[policy({})]]) });
    const findings = await rls002.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("apanha a variante (1 = 1)", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[policy({ qual: "(1 = 1)" })]]) });
    expect(await rls002.check(ctx)).toHaveLength(1);
  });

  it("apanha auth.role() = 'anon'::text em FOR SELECT TO anon", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[policy({ qual: "(auth.role() = 'anon'::text)" })]]),
    });
    expect(await rls002.check(ctx)).toHaveLength(1);
  });

  it("apanha auth.uid() is not null em TO public", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [policy({ roles: ["public"], qual: "(auth.uid() is not null)" })],
      ]),
    });
    expect(await rls002.check(ctx)).toHaveLength(1);
  });

  it("ignora política restritiva a authenticated", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [policy({ roles: ["authenticated"], qual: "(auth.uid() = user_id)" })],
      ]),
    });
    expect(await rls002.check(ctx)).toHaveLength(0);
  });

  it("ignora INSERT aberto (não é leitura)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[policy({ cmd: "INSERT", qual: null, with_check: "true" })]]),
    });
    expect(await rls002.check(ctx)).toHaveLength(0);
  });
});
