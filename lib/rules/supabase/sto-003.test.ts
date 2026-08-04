import { describe, expect, it } from "vitest";
import { sto003 } from "./sto-003";
import { createFakeSql, createTestContext } from "../test-utils";

describe("STO-003", () => {
  it("high quando o bucket não tem nenhuma política de storage", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([[{ id: "avatars" }], []]),
    });

    const findings = await sto003.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("sem políticas");
  });

  it("high quando a política restringe só por bucket_id, sem dono/path", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ id: "avatars" }],
        [
          {
            policyname: "avatars_read",
            cmd: "SELECT",
            roles: ["authenticated"],
            qual: "(bucket_id = 'avatars'::text)",
            with_check: null,
            schemaname: "storage",
            tablename: "objects",
          },
        ],
      ]),
    });

    const findings = await sto003.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("dono/path");
  });

  it("sem finding quando a política restringe por auth.uid() via foldername", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ id: "avatars" }],
        [
          {
            policyname: "avatars_read_own",
            cmd: "SELECT",
            roles: ["authenticated"],
            qual: "(bucket_id = 'avatars'::text and (storage.foldername(name))[1] = (auth.uid())::text)",
            with_check: null,
            schemaname: "storage",
            tablename: "objects",
          },
        ],
      ]),
    });

    expect(await sto003.check(ctx)).toHaveLength(0);
  });

  it("sem findings quando não há buckets", async () => {
    const ctx = createTestContext({ admin: createFakeSql([[]]) });
    expect(await sto003.check(ctx)).toHaveLength(0);
  });
});
