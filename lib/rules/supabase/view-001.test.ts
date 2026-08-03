import { describe, expect, it } from "vitest";
import { view001 } from "./view-001";
import { createFakeSql, createTestContext } from "../test-utils";

describe("VIEW-001", () => {
  it("critical: vista sem security_invoker, legível por anon, sobre tabela com RLS", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            view_name: "user_stats",
            relkind: "v",
            owner: "postgres",
            anon_select: true,
            security_invoker: "false",
            source_tables: ["public.profiles"],
          },
        ],
        [{ table_name: "profiles", relrowsecurity: true }],
      ]),
    });

    const findings = await view001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
  });

  it("sem finding quando security_invoker = true", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            view_name: "user_stats",
            relkind: "v",
            owner: "postgres",
            anon_select: true,
            security_invoker: "true",
            source_tables: ["public.profiles"],
          },
        ],
        [{ table_name: "profiles", relrowsecurity: true }],
      ]),
    });

    expect(await view001.check(ctx)).toHaveLength(0);
  });

  it("materialized view: sempre critical se acessível a anon e fonte protegida (sem security_invoker possível)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            view_name: "mv_user_stats",
            relkind: "m",
            owner: "postgres",
            anon_select: true,
            security_invoker: "false",
            source_tables: ["public.profiles"],
          },
        ],
        [{ table_name: "profiles", relrowsecurity: true }],
      ]),
    });

    const findings = await view001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Materialized");
  });

  it("sem finding quando a tabela fonte não tem RLS (nada a contornar)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            view_name: "public_products_view",
            relkind: "v",
            owner: "postgres",
            anon_select: true,
            security_invoker: "false",
            source_tables: ["public.products"],
          },
        ],
        [{ table_name: "products", relrowsecurity: false }],
      ]),
    });

    expect(await view001.check(ctx)).toHaveLength(0);
  });
});
