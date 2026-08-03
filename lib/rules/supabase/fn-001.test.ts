import { describe, expect, it } from "vitest";
import { fn001 } from "./fn-001";
import { createFakeSql, createTestContext } from "../test-utils";

function fnRow(overrides: Record<string, unknown> = {}) {
  return {
    schema_name: "public",
    function_name: "promote_user",
    args: "uid uuid",
    is_security_definer: true,
    owner: "postgres",
    anon_execute: false,
    auth_execute: false,
    ...overrides,
  };
}

describe("FN-001", () => {
  it("critical quando anon tem EXECUTE", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[fnRow({ anon_execute: true })]]) });
    const findings = await fn001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("critical quando só authenticated tem EXECUTE", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[fnRow({ auth_execute: true })]]) });
    expect((await fn001.check(ctx))[0]?.severity).toBe("critical");
  });

  it("medium quando nenhum dos dois tem EXECUTE", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[fnRow({})]]) });
    expect((await fn001.check(ctx))[0]?.severity).toBe("medium");
  });

  it("ignora funções internas do Supabase (owner de sistema, fora de public)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[fnRow({ schema_name: "auth", owner: "supabase_auth_admin" })]]),
    });
    expect(await fn001.check(ctx)).toHaveLength(0);
  });

  it("ignora funções com prefixo pgrst_ ou _supabase", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[fnRow({ function_name: "pgrst_watch" })]]),
    });
    expect(await fn001.check(ctx)).toHaveLength(0);
  });
});
