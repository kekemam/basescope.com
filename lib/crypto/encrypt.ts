import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Sem `import "server-only"` de propósito: usa só `node:crypto`, que não
// resolve num bundle de browser (o build do Next falha logo se algo tentar
// puxar isto para um Client Component), e isso mantém o módulo testável
// com vitest fora do runtime do Next.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function loadKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY não está definida");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY tem de ser 32 bytes (AES-256) codificados em base64");
  }
  return key;
}

/**
 * Formato do buffer devolvido: iv (12 bytes) || authTag (16 bytes) || ciphertext.
 * Guarda-se tal e qual na coluna `bytea` `projects.encrypted_credentials`.
 */
export function encryptCredentials(plaintext: string): Buffer {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptCredentials(stored: Buffer): string {
  const key = loadKey();
  const iv = stored.subarray(0, IV_LENGTH);
  const authTag = stored.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = stored.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Token de verificação de propriedade (secção 0 do PROJECT_SPEC), derivado
 * do id do projeto — não precisa de coluna própria em BD nem de round-trip
 * extra: recalcula-se sempre que se verifica, e é impossível de adivinhar
 * sem a ENCRYPTION_KEY do servidor.
 */
export function verificationTokenForProject(projectId: string): string {
  const key = loadKey();
  return createHmac("sha256", key).update(projectId).digest("hex").slice(0, 32);
}

/** Compara duas strings em tempo constante — usa-se para validar HMAC de webhooks. */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
