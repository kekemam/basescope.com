import { describe, expect, it } from "vitest";
import { grant001 } from "./grant-001";
import { createFakeSql, createTestContext } from "../test-utils";

describe("GRANT-001", () => {
  it("critical quando anon pode fazer CREATE no schema public", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ nspname: "public", anon_create: true, anon_usage: true, auth_create: false }],
        [],
      ]),
    });
    const findings = await grant001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.resourceName).toBe("schema public");
  });

  it("critical quando anon escreve numa tabela sem RLS", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ nspname: "public", anon_create: false, anon_usage: true, auth_create: false }],
        [
          {
            relname: "orders",
            relrowsecurity: false,
            anon_insert: true,
            anon_update: false,
            anon_delete: false,
            anon_truncate: false,
          },
        ],
      ]),
    });
    const findings = await grant001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.resourceName).toBe("public.orders");
  });

  it("critical quando anon pode fazer TRUNCATE, mesmo com RLS ativo", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ nspname: "public", anon_create: false, anon_usage: true, auth_create: false }],
        [
          {
            relname: "logs",
            relrowsecurity: true,
            anon_insert: false,
            anon_update: false,
            anon_delete: false,
            anon_truncate: true,
          },
        ],
      ]),
    });
    const findings = await grant001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("truncar");
  });

  it("sem finding quando a tabela tem RLS e não há TRUNCATE", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ nspname: "public", anon_create: false, anon_usage: true, auth_create: false }],
        [
          {
            relname: "contact_messages",
            relrowsecurity: true,
            anon_insert: true,
            anon_update: false,
            anon_delete: false,
            anon_truncate: false,
          },
        ],
      ]),
    });
    expect(await grant001.check(ctx)).toHaveLength(0);
  });
});
