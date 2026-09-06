export function formatQuantity(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toString().replace(".", ",");
}
