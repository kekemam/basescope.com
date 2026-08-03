import type { Finding, Rule, Severity, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { normalize, OPEN, rolesInclude, type PgPolicyRow } from "./_shared";

interface BucketRow {
  id: string;
  name: string;
  public: boolean;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
}

interface BucketObjectStatsRow {
  bucket_id: string;
  total_objects: number;
  sensitive_named: number;
  document_files: number;
}

const RULE_ID = "STO-001";
const DOCS_URL = docsUrlFor(RULE_ID);

const SENSITIVE_NAME_PATTERN =
  "(passport|passaporte|id[-_ ]?card|cartao[-_ ]?cidadao|" +
  "selfie|face|photo[-_ ]?id|driver|licen[sc]a|" +
  "invoice|fatura|receipt|contract|contrato|" +
  "payslip|recibo|iban|bank|extrato|" +
  "medical|report|scan|document|nif|ssn|kyc)";

function bucketSeverity(stats: BucketObjectStatsRow | undefined): Severity | null {
  if (!stats || stats.total_objects === 0) return null;
  if (stats.sensitive_named > 0) return "critical";
  if (stats.document_files > 0) return "high";
  return "medium";
}

function privateEnoughRemediation(bucket: string) {
  return {
    sql: `update storage.buckets set public = false where id = '${bucket}';

create policy "${bucket}_read_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = '${bucket}'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "${bucket}_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = '${bucket}'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = '${bucket}';`,
    steps: [
      "Torna o bucket privado.",
      "Cria políticas de storage restritas ao dono da pasta (`auth.uid()`).",
      "Aviso: torna inválidos todos os URLs públicos já em circulação — passa a usar `createSignedUrl()`.",
      "Define `file_size_limit` e `allowed_mime_types`.",
    ],
  };
}

export const sto001: Rule = {
  id: RULE_ID,
  title: "Bucket público com ficheiros sensíveis",
  severity: "critical",
  category: "storage",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const buckets = await ctx.admin<BucketRow[]>`
      select id, name, public, file_size_limit, allowed_mime_types
      from storage.buckets
      where public = true
    `;

    const stats = await ctx.admin<BucketObjectStatsRow[]>`
      select bucket_id,
             count(*) as total_objects,
             count(*) filter (where name ~* ${SENSITIVE_NAME_PATTERN}) as sensitive_named,
             count(*) filter (where name ~* '\\.(pdf|docx?|xlsx?|csv)$') as document_files
      from storage.objects
      where bucket_id = any(${buckets.map((b) => b.id)})
      group by bucket_id
    `;
    const statsByBucket = new Map(stats.map((s) => [s.bucket_id, s]));

    for (const bucket of buckets) {
      const severity = bucketSeverity(statsByBucket.get(bucket.id));
      if (!severity) continue;

      const bucketStats = statsByBucket.get(bucket.id);
      const remed = privateEnoughRemediation(bucket.id);
      findings.push({
        ruleId: RULE_ID,
        severity,
        resourceType: "bucket",
        resourceName: bucket.id,
        title: "Bucket público com ficheiros sensíveis",
        description: `O bucket "${bucket.id}" é público e contém ${bucketStats?.sensitive_named ?? 0} ficheiros com nomes sugestivos de documentos pessoais.`,
        evidence: {
          bucket: bucket.id,
          total_objects: bucketStats?.total_objects ?? 0,
          sensitive_named: bucketStats?.sensitive_named ?? 0,
          document_files: bucketStats?.document_files ?? 0,
          file_size_limit: bucket.file_size_limit,
          allowed_mime_types: bucket.allowed_mime_types,
        },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      });
    }

    // Um bucket privado com política `using (true)` está tão aberto como um
    // público — aplica-se a mesma lógica de RLS-002 às políticas de storage.
    const storagePolicies = await ctx.admin<PgPolicyRow[]>`
      select policyname, cmd, roles, qual, with_check, schemaname, tablename
      from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
    `;

    for (const policy of storagePolicies) {
      if (!["SELECT", "ALL"].includes(policy.cmd)) continue;
      if (!rolesInclude(policy.roles, "anon")) continue;
      if (!OPEN.has(normalize(policy.qual))) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: "critical",
        resourceType: "bucket",
        resourceName: `storage.objects policy ${policy.policyname}`,
        title: "Política de storage totalmente aberta ao anónimo",
        description: `A política "${policy.policyname}" em storage.objects permite a qualquer pessoa listar/ler ficheiros de qualquer bucket, mesmo privado.`,
        evidence: { policy: policy.policyname, cmd: policy.cmd, roles: policy.roles, qual: policy.qual },
        remediationSql: `drop policy if exists "${policy.policyname}" on storage.objects;`,
        remediationSteps: ["Remove a política aberta e recria-a restrita por bucket e por dono (auth.uid())."],
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
