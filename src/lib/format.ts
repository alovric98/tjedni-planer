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
