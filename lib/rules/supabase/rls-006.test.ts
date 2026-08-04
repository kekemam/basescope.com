import { describe, expect, it } from "vitest";
import { rls006 } from "./rls-006";
import { createFakeSql, createTestContext } from "../test-utils";
import type { PgPolicyRow } from "./_shared";

function policy(overrides: Partial<PgPolicyRow>): PgPolicyRow {
  return {
    schemaname: "public",
    tablename: "orders",
    policyname: "orders_by_header",
    permissive: "PERMISSIVE",
    roles: ["authenticated"],
    cmd: "SELECT",
    qual: "(user_id = (current_setting('request.header.x-user-id'::text, true))::uuid)",
    with_check: null,
    ...overrides,
  };
}

describe("RLS-006", () => {
  it("high quando a política usa um header HTTP em vez de auth.uid()", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[policy({})]]) });
    const findings = await rls006.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
  });

  it("não reporta auth.uid() normal", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[policy({ qual: "(auth.uid() = user_id)" })]]),
    });
    expect(await rls006.check(ctx)).toHaveLength(0);
  });

  it("não reporta request.jwt.claims (verificado pelo PostgREST)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [policy({ qual: "(user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'))" })],
      ]),
    });
    expect(await rls006.check(ctx)).toHaveLength(0);
  });

  it("apanha também em with_check", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [policy({ qual: null, with_check: "current_setting('request.header.x-user-id')" })],
      ]),
    });
    expect(await rls006.check(ctx)).toHaveLength(1);
  });
});
