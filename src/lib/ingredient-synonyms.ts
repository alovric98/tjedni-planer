/**
 * Regionalni/dijalektalni nazivi sastojaka koji u hrvatskim trgovačkim
 * cjenicima (Kaufland/Lidl) stoje pod drugim, standardnim nazivom - npr.
 * "biber" (bosanski/dijalektalni naziv) vs "papar" (jedini naziv koji
 * koristi Kaufland cjenik, provjereno 29.09.2026). Riječi ovdje su već
 * normalizirane (normalize() - malim slovima, bez dijakritike) jer se
 * ovako uspoređuju i u matching.ts.
 *
 * Svaka grupa je lista međusobno zamjenjivih riječi - matcher ih tretira
 * kao ravnopravne alternative kad traži cijelu riječ/prefiks u nazivu
 * proizvoda (wordScore u matching.ts), a "bez X" negacijska logika i dalje
 * vrijedi zasebno za svaku alternativu. Dodaj novi par samo kad postoji
 * stvaran primjer u receptima ili cjeniku - ne nagađaj parove.
 */
const SYNONYM_GROUPS: string[][] = [
  ["biber", "papar"],
  // Lidl katalog ima samo "Cvjetača", Kaufland uz "Cvjetača" i jedan
  // "KBio.Karfiol" - bez ovoga "karfiol" na Lidlu ne pogađa ništa, a na
  // Kauflandu samo skupu BIO varijantu (provjereno 30.9.2026).
  ["karfiol", "cvjetaca"],
];

const SYNONYM_INDEX: Map<string, string[]> = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    SYNONYM_INDEX.set(
      word,
      group.filter((w) => w !== word)
    );
  }
}

export function synonymsOf(word: string): string[] {
  return SYNONYM_INDEX.get(word) ?? [];
}
