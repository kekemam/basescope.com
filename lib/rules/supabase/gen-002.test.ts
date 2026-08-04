import { describe, expect, it } from "vitest";
import { gen002 } from "./gen-002";
import { createFakeSql, createTestContext } from "../test-utils";

describe("GEN-002", () => {
  it("low quando a coluna de posse não tem índice", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            schemaname: "public",
            tablename: "orders",
            policyname: "orders_select_own",
            permissive: "PERMISSIVE",
            roles: ["authenticated"],
            cmd: "SELECT",
            qual: "(auth.uid() = user_id)",
            with_check: null,
          },
        ],
        [],
      ]),
    });

    const findings = await gen002.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence.column).toBe("user_id");
  });

  it("sem finding quando já existe índice na coluna", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            schemaname: "public",
            tablename: "orders",
            policyname: "orders_select_own",
            permissive: "PERMISSIVE",
            roles: ["authenticated"],
            cmd: "SELECT",
            qual: "(auth.uid() = user_id)",
            with_check: null,
          },
        ],
        [{ table_name: "orders", column_name: "user_id" }],
      ]),
    });

    expect(await gen002.check(ctx)).toHaveLength(0);
  });

  it("sem finding quando a política não segue o padrão auth.uid() = coluna", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [
          {
            schemaname: "public",
            tablename: "products",
            policyname: "products_public",
            permissive: "PERMISSIVE",
            roles: ["anon"],
            cmd: "SELECT",
            qual: "(published = true)",
            with_check: null,
          },
        ],
      ]),
    });

    expect(await gen002.check(ctx)).toHaveLength(0);
  });
});
