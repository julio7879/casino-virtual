export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RouletteBetType =
  | "pleno"
  | "caballo"
  | "calle"
  | "cuadro"
  | "linea"
  | "docena"
  | "columna"
  | "rojo"
  | "negro"
  | "par"
  | "impar"
  | "falta"
  | "pasa";

export type RouletteBet = {
  tipo: RouletteBetType;
  numeros?: number[];
  monto: number;
};

const PAYOUT: Record<RouletteBetType, number> = {
  pleno: 35,
  caballo: 17,
  calle: 11,
  cuadro: 8,
  linea: 5,
  docena: 2,
  columna: 2,
  rojo: 1,
  negro: 1,
  par: 1,
  impar: 1,
  falta: 1,
  pasa: 1,
};

export function covers(bet: RouletteBet, n: number): boolean {
  switch (bet.tipo) {
    case "pleno":
    case "caballo":
    case "calle":
    case "cuadro":
    case "linea":
      return (bet.numeros ?? []).includes(n);
    case "docena": {
      const d = bet.numeros?.[0] ?? 1;
      if (d === 1) return n >= 1 && n <= 12;
      if (d === 2) return n >= 13 && n <= 24;
      return n >= 25 && n <= 36;
    }
    case "columna": {
      const c = bet.numeros?.[0] ?? 1;
      return n > 0 && n % 3 === c % 3 && (c === 3 ? n % 3 === 0 : n % 3 === c);
    }
    case "rojo":
      return n !== 0 && RED_NUMBERS.has(n);
    case "negro":
      return n !== 0 && !RED_NUMBERS.has(n);
    case "par":
      return n !== 0 && n % 2 === 0;
    case "impar":
      return n !== 0 && n % 2 === 1;
    case "falta":
      return n >= 1 && n <= 18;
    case "pasa":
      return n >= 19 && n <= 36;
    default:
      return false;
  }
}

/** ganancia = total devuelto (apuesta incluida) */
export function settleBets(bets: RouletteBet[], result: number) {
  let returned = 0;
  const detalle = bets.map((bet) => {
    const win = covers(bet, result);
    const payout = win ? bet.monto * (PAYOUT[bet.tipo] + 1) : 0;
    returned += payout;
    return { ...bet, gano: win, pagado: payout };
  });
  const staked = bets.reduce((s, b) => s + b.monto, 0);
  return { staked, returned, detalle };
}
