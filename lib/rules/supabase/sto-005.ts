import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface BucketMimeRow {
  id: string;
  allowed_mime_types: string[] | null;
}

const RULE_ID = "STO-005";
const DOCS_URL = docsUrlFor(RULE_ID);

export const sto005: Rule = {
  id: RULE_ID,
  title: "Bucket sem restrição de tipos de ficheiro (allowed_mime_types)",
  severity: "medium",
  category: "storage",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const rows = await ctx.admin<BucketMimeRow[]>`
      select id, allowed_mime_types
      from storage.buckets
      where allowed_mime_types is null or array_length(allowed_mime_types, 1) is null
    `;

    return rows.map((row) => ({
      ruleId: RULE_ID,
      severity: "medium" as const,
      resourceType: "bucket" as const,
      resourceName: row.id,
      title: "Bucket sem allowed_mime_types",
      description: `O bucket "${row.id}" aceita qualquer tipo de ficheiro, incluindo HTML/SVG executável — vetor de XSS armazenado se o bucket for público.`,
      evidence: { bucket: row.id, allowed_mime_types: row.allowed_mime_types },
      remediationSql: `update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = '${row.id}'; -- ajusta à lista de tipos que este bucket realmente precisa`,
      remediationSteps: ["Restringe allowed_mime_types aos tipos de ficheiro que este bucket realmente precisa aceitar."],
      docsUrl: DOCS_URL,
    }));
  },
};
