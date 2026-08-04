import type { Rule } from "../types";
import { anon001 } from "./anon-001";
import { rls001 } from "./rls-001";
import { rls002 } from "./rls-002";
import { rls003 } from "./rls-003";
import { rls006 } from "./rls-006";
import { rls007 } from "./rls-007";
import { pii001 } from "./pii-001";
import { fn001 } from "./fn-001";
import { fn003 } from "./fn-003";
import { fn005 } from "./fn-005";
import { fn006 } from "./fn-006";
import { grant001 } from "./grant-001";
import { view001 } from "./view-001";
import { sto001 } from "./sto-001";
import { sto003 } from "./sto-003";
import { sto004 } from "./sto-004";
import { sto005 } from "./sto-005";
import { auth001 } from "./auth-001";
import { auth006 } from "./auth-006";
import { auth007 } from "./auth-007";
import { ef001 } from "./ef-001";
import { ef002 } from "./ef-002";
import { ef004 } from "./ef-004";
import { gen001 } from "./gen-001";
import { gen002 } from "./gen-002";
import { gen003 } from "./gen-003";
import { client001 } from "./client-001";
import { client002 } from "./client-002";
import { client003 } from "./client-003";
import { client005 } from "./client-005";
import { client006 } from "./client-006";

/**
 * Ordem de execução e orçamento de tempo (docs/rules-critical.md): mais
 * rápidas primeiro, para o utilizador ver resultados aos 2s e não aos 30s.
 * O orquestrador (lib/scan/run-scan.ts) corre cada array em paralelo.
 *
 * 1. Só catálogo Postgres (rápido).
 * 2. Storage — também só catálogo, lote próprio por convenção temática.
 * 3. Management API — precisa de OAuth (ctx.mgmtToken), senão devolve [].
 * 4. ANON-001 — sonda HTTP por tabela, o mais lento dos catalog-based.
 * 5. CLIENT-* que exigem domínio verificado — descarrega bundles JS.
 */
export const RULE_BATCHES: Rule[][] = [
  [rls001, rls002, rls003, rls006, rls007, fn001, fn003, fn005, fn006, grant001, view001, pii001, gen002, gen003, client006],
  [sto001, sto003, sto004, sto005],
  [auth001, auth006, auth007, ef001, ef002, ef004, gen001],
  [anon001],
  [client001, client002, client003, client005],
];

export const ALL_RULES: Rule[] = RULE_BATCHES.flat();

export {
  anon001,
  rls001,
  rls002,
  rls003,
  rls006,
  rls007,
  pii001,
  fn001,
  fn003,
  fn005,
  fn006,
  grant001,
  view001,
  sto001,
  sto003,
  sto004,
  sto005,
  auth001,
  auth006,
  auth007,
  ef001,
  ef002,
  ef004,
  gen001,
  gen002,
  gen003,
  client001,
  client002,
  client003,
  client005,
  client006,
};
