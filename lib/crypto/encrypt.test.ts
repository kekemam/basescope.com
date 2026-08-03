import { describe, expect, it, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptCredentials, decryptCredentials, constantTimeEqual, verificationTokenForProject } from "./encrypt";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptCredentials / decryptCredentials", () => {
  it("faz round-trip do texto original", () => {
    const plaintext = "sb_secret_abc123";
    const encrypted = encryptCredentials(plaintext);
    expect(decryptCredentials(encrypted)).toBe(plaintext);
  });

  it("produz um ciphertext diferente a cada chamada (IV aleatório)", () => {
    const a = encryptCredentials("mesma-chave");
    const b = encryptCredentials("mesma-chave");
    expect(a.equals(b)).toBe(false);
  });

  it("rejeita ciphertext adulterado (auth tag falha)", () => {
    const encrypted = encryptCredentials("segredo");
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    expect(() => decryptCredentials(tampered)).toThrow();
  });

  it("rejeita quando falta ENCRYPTION_KEY", () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptCredentials("x")).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = saved;
  });
});

describe("verificationTokenForProject", () => {
  it("é determinístico para o mesmo projeto", () => {
    expect(verificationTokenForProject("proj-1")).toBe(verificationTokenForProject("proj-1"));
  });

  it("difere entre projetos diferentes", () => {
    expect(verificationTokenForProject("proj-1")).not.toBe(verificationTokenForProject("proj-2"));
  });
});

describe("constantTimeEqual", () => {
  it("true para strings iguais", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });

  it("false para strings diferentes do mesmo tamanho", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });

  it("false para strings de tamanhos diferentes", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});
