import type postgres from "postgres";
import type { AnonRestClient, ScanContext } from "./types";

/**
 * Fake de `postgres.Sql` para testes unitários de regras. Cada chamada a
 * `ctx.admin\`...\`` consome, por ordem, o próximo array de linhas em
 * `responses` — não interpreta o SQL em si. As regras já têm as queries
 * documentadas em docs/rules-critical.md; o que os testes verificam é a
 * classificação em JS a partir dos dados devolvidos.
 */
export function createFakeSql(responses: unknown[][]): postgres.Sql {
  let call = 0;
  const fn = async (): Promise<unknown[]> => {
    if (call >= responses.length) {
      throw new Error(`createFakeSql: chamada ${call + 1} sem resposta preparada`);
    }
    return responses[call++]!;
  };
  return fn as unknown as postgres.Sql;
}

export function createFakeAnonRest(
  counts: Record<string, { status: number; totalCount: number | null }>,
): AnonRestClient {
  return {
    async headCount(table: string) {
      return counts[table] ?? { status: 404, totalCount: null };
    },
    async headStorageObject() {
      return { status: 404, contentLength: null };
    },
  };
}

export function createTestContext(overrides: Partial<ScanContext> & { admin: postgres.Sql }): ScanContext {
  return {
    anonRest: createFakeAnonRest({}),
    projectRef: "test-ref",
    verifiedDomain: null,
    mgmtToken: null,
    ...overrides,
  };
}
