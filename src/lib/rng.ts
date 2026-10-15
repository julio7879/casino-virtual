import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

/** Uniforme en [0, 1). Nunca usa Math.random(). */
export function randomUnit(): number {
  const buf = randomBytes(7);
  const n = buf.readUIntBE(0, 7);
  return n / 0x1_0000_0000_0000_00;
}

export function randomIntExclusive(min: number, maxExclusive: number): number {
  return randomInt(min, maxExclusive);
}

export function newServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function serverSeedHash(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

export function hmacUnit(serverSeed: string, message: string): number {
  const digest = createHmac("sha256", serverSeed).update(message).digest();
  const n = digest.readUIntBE(0, 6);
  return n / 0x1_0000_0000_0000;
}

export function fisherYates<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
