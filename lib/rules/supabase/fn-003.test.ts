import { describe, expect, it } from "vitest";
import { fn003 } from "./fn-003";
import { createFakeSql, createTestContext } from "../test-utils";

function fnRow(overrides: Record<string, unknown> = {}) {
  return {
    schema_name: "public",
    function_name: "log_event",
    args: "msg text",
    definition: "create function public.log_event(msg text) returns void language sql as $$ insert into public.logs (message) values (msg) $$;",
    owner: "postgres",
    anon_execute: false,
    auth_execute: true,
    ...overrides,
  };
}

describe("FN-003", () => {
  it("high quando a função escreve sem referenciar auth.uid()", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[fnRow({})]]) });
    const findings = await fn003.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
  });

  it("critical quando também é executável por anon", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[fnRow({ anon_execute: true })]]) });
    expect((await fn003.check(ctx))[0]?.severity).toBe("critical");
  });

  it("sem finding quando o corpo referencia auth.uid()", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [fnRow({ definition: "... insert into public.logs (user_id) values (auth.uid()) ..." })],
      ]),
    });
    expect(await fn003.check(ctx)).toHaveLength(0);
  });

  it("sem finding quando a função não escreve nada (só leitura)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[fnRow({ definition: "select count(*) from public.logs" })]]),
    });
    expect(await fn003.check(ctx)).toHaveLength(0);
  });

  it("ignora funções internas do Supabase", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[fnRow({ function_name: "pgrst_watch" })]]),
    });
    expect(await fn003.check(ctx)).toHaveLength(0);
  });
});
