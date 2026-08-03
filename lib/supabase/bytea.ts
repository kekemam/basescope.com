/**
 * PostgREST espera/devolve colunas `bytea` como hex prefixado com "\x"
 * (o formato de output por omissão do Postgres) em vez de base64 — o
 * client supabase-js não faz esta conversão sozinho.
 */
export function bufferToPostgresBytea(buf: Buffer): string {
  return "\\x" + buf.toString("hex");
}

export function postgresByteaToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/^\\x/, ""), "hex");
}
