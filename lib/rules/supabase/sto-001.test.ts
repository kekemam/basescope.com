import { describe, expect, it } from "vitest";
import { sto001 } from "./sto-001";
import { createFakeSql, createTestContext } from "../test-utils";

describe("STO-001", () => {
  it("critical quando o bucket público tem ficheiros com nomes sensíveis", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ id: "documents", name: "documents", public: true, file_size_limit: null, allowed_mime_types: null }],
        [{ bucket_id: "documents", total_objects: 10, sensitive_named: 3, document_files: 3 }],
        [],
      ]),
    });

    const findings = await sto001.check(ctx);
    expect(findings.some((f) => f.severity === "critical" && f.resourceName === "documents")).toBe(true);
  });

  it("high quando só há ficheiros de documento sem nomes sensíveis", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ id: "reports", name: "reports", public: true, file_size_limit: null, allowed_mime_types: null }],
        [{ bucket_id: "reports", total_objects: 5, sensitive_named: 0, document_files: 5 }],
        [],
      ]),
    });

    const findings = await sto001.check(ctx);
    expect(findings[0]?.severity).toBe("high");
  });

  it("medium quando o bucket público só tem imagens", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [{ id: "avatars", name: "avatars", public: true, file_size_limit: null, allowed_mime_types: null }],
        [{ bucket_id: "avatars", total_objects: 20, sensitive_named: 0, document_files: 0 }],
        [],
      ]),
    });

    const findings = await sto001.check(ctx);
    expect(findings[0]?.severity).toBe("medium");
  });

  it("critical quando uma política de storage é aberta a anon (bucket privado tão exposto como público)", async () => {
    const ctx = createTestContext({
      admin: createFakeSql([
        [],
        [],
        [
          {
            policyname: "objects_open",
            cmd: "SELECT",
            roles: ["anon"],
            qual: "true",
            with_check: null,
            schemaname: "storage",
            tablename: "objects",
          },
        ],
      ]),
    });

    const findings = await sto001.check(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Política de storage");
  });
});
