import type { Rule } from "../types";
import { anon001 } from "./anon-001";
import { rls001 } from "./rls-001";
import { rls002 } from "./rls-002";
import { rls003 } from "./rls-003";
import { pii001 } from "./pii-001";
import { fn001 } from "./fn-001";
import { grant001 } from "./grant-001";
import { view001 } from "./view-001";
import { sto001 } from "./sto-001";
import { auth001 } from "./auth-001";
import { ef001 } from "./ef-001";
import { client001 } from "./client-001";
import { client002 } from "./client-002";

/**
 * Ordem de execução e orçamento de tempo (docs/rules-critical.md): mais
 * rápidas primeiro, para o utilizador ver resultados aos 2s e não aos 30s.
 * O orquestrador (lib/scan/run-scan.ts) corre cada array em paralelo.
 */
export const RULE_BATCHES: Rule[][] = [
  [rls001, rls002, rls003, fn001, grant001, view001, pii001],
  [sto001],
  [auth001, ef001],
  [anon001],
  [client001, client002],
];

export const ALL_RULES: Rule[] = RULE_BATCHES.flat();

export {
  anon001,
  rls001,
  rls002,
  rls003,
  pii001,
  fn001,
  grant001,
  view001,
  sto001,
  auth001,
  ef001,
  client001,
  client002,
};
