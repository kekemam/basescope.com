import type { Severity } from "@/lib/rules/types";

export interface FindingViewModel {
  id: string;
  ruleId: string;
  severity: Severity;
  resourceName: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  remediationSql: string | null;
  remediationSteps: string[];
  status: string;
}
