import { describe, expect, it } from "vitest";
import { fn005 } from "./fn-005";
import { createFakeSql, createTestContext } from "../test-utils";

describe("FN-005", () => {
  it("medium quando um trigger em tabela anon-writable propaga NEW.* para tabela com PII", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "profiles" }],
        [
          {
            trigger_name: "contact_to_profile",
            source_table: "contact_messages",
            anon_can_insert: true,
            anon_can_update: false,
            trigger_body: "insert into public.profiles (email) values (new.email);",
          },
        ],
      ]),
    });

    const findings = await fn005.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("sem finding quando a tabela de origem não é escrevível por anon", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "profiles" }],
        [
          {
            trigger_name: "internal_sync",
            source_table: "findings",
            anon_can_insert: false,
            anon_can_update: false,
            trigger_body: "insert into public.profiles (email) values (new.email);",
          },
        ],
      ]),
    });

    expect(await fn005.check(ctx)).toHaveLength(0);
  });

  it("sem finding quando não há tabelas com PII", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[]]) });
    expect(await fn005.check(ctx)).toHaveLength(0);
  });

  it("sem finding quando o trigger não escreve em tabela com PII", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ table_name: "profiles" }],
        [
          {
            trigger_name: "log_visit",
            source_table: "contact_messages",
            anon_can_insert: true,
            anon_can_update: false,
            trigger_body: "insert into public.visit_log (path) values (new.path);",
          },
        ],
      ]),
    });

    expect(await fn005.check(ctx)).toHaveLength(0);
  });
});
