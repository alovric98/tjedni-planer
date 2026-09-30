export function formatQuantity(q: number): string {
  // Zaokruži na max 2 decimale prije prikaza - bez ovoga npr. 1/3 ispiše
  // 7 decimala (audit N20).
  const rounded = Math.round(q * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString().replace(".", ",");
}

const BASIS_LABEL: Record<string, string> = { kg: "kg", l: "l", kom: "kom" };

export function formatBasisQuantity(q: number, basis: string): string {
  return `${formatQuantity(q)} ${BASIS_LABEL[basis] ?? basis}`;
}

/**
 * Čitljiva količina pakiranja/viška: ispod 1 kg/l u g/ml ("50 g", "458 ml"),
 * inače u kg/l. Zaokruženo na cijele g/ml da float šum (0.1 - 0.05) ne
 * ispiše "0,05000000000000001 kg".
 */
export function formatMeasure(q: number, basis: string): string {
  if (basis === "kom") return `${formatQuantity(q)} kom`;
  if (q < 1) return `${Math.round(q * 1000)} ${basis === "l" ? "ml" : "g"}`;
  return formatBasisQuantity(q, basis);
}
