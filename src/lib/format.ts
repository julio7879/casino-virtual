export function formatFichas(n: number | bigint | string): string {
  const value = typeof n === "bigint" ? Number(n) : Number(n);
  if (!Number.isFinite(value)) return "0";
  return Math.trunc(value).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

export function formatMult(m: number): string {
  return `${m.toFixed(2)}x`;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
