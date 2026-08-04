import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface BucketLimitRow {
  id: string;
  file_size_limit: number | null;
}

const RULE_ID = "STO-004";
const DOCS_URL = docsUrlFor(RULE_ID);

export const sto004: Rule = {
  id: RULE_ID,
  title: "Bucket sem limite de tamanho de ficheiro",
  severity: "medium",
  category: "storage",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const rows = await ctx.admin<BucketLimitRow[]>`
      select id, file_size_limit from storage.buckets where file_size_limit is null
    `;

    return rows.map((row) => ({
      ruleId: RULE_ID,
      severity: "medium" as const,
      resourceType: "bucket" as const,
      resourceName: row.id,
      title: "Bucket sem limite de tamanho de ficheiro",
      description: `O bucket "${row.id}" não tem file_size_limit — qualquer utilizador com acesso de escrita pode encher o storage com ficheiros enormes.`,
      evidence: { bucket: row.id, file_size_limit: null },
      remediationSql: `update storage.buckets set file_size_limit = 10485760 where id = '${row.id}'; -- 10 MB, ajusta ao caso de uso`,
      remediationSteps: ["Define um file_size_limit apropriado ao tipo de ficheiro esperado neste bucket."],
      docsUrl: DOCS_URL,
    }));
  },
};
