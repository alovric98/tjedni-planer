import { normalize } from "@/lib/normalize";
import type { ProductForMatching } from "@/lib/products";

const STOPWORDS = new Set(["i", "u", "s", "sa", "za", "od", "na", "po", "te", "ili"]);

type IndexedProduct = {
  product: ProductForMatching;
  normalizedName: string;
};

export type ProductIndex = IndexedProduct[];

export function buildProductIndex(products: ProductForMatching[]): ProductIndex {
  return products.map((product) => ({
    product,
    // Kaufland/Lidl nazivi često spajaju riječi interpunkcijom bez razmaka
    // ("KLC.Tjestenina", "Naturel_OC") - to bi inače sakrilo prvu/zadnju
    // riječ od provjere granice riječi ispod.
    normalizedName: normalize(product.name.replace(/[._\-/]+/g, " ")),
  }));
}

function queryWordsOf(ingredientName: string): string[] {
  // Zagrade su opisne napomene za korisnika ("crveni grah (konzerva)",
  // "feta sir (light)"), ne dio naziva koji bi trebao doslovno stajati u
  // nazivu proizvoda.
  const withoutParens = ingredientName.replace(/\([^)]*\)/g, " ");
  return normalize(withoutParens)
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bodovanje jedne riječi upita naspram naziva proizvoda:
 * 2 = stoji kao cijela riječ (npr. "luk" u "Luk 750g")
 * 1 = poklapa se korijen/prefiks riječi, otporno na jedninu/množinu i
 *     skraćene varijante ("tikvice" -> "tikvica", "integralna" -> "integralne")
 * 0 = nema stvarne veze
 * Riječi kraće od 3 znaka se ne boduju - premalo su specifične sam za sebe
 * i lako bi lažno pogodile nepovezan proizvod.
 */
function wordScore(word: string, target: string): number {
  if (word.length < 3) return 0;
  if (new RegExp(`(^|\\s)${escapeRegExp(word)}(\\s|$)`).test(target)) return 2;
  const prefixLength = Math.min(word.length, Math.max(4, Math.ceil(word.length * 0.7)));
  return target.includes(word.slice(0, prefixLength)) ? 1 : 0;
}

export function matchProduct(index: ProductIndex, ingredientName: string): ProductForMatching | null {
  const queryWords = queryWordsOf(ingredientName);
  if (queryWords.length === 0) return null;

  // Hrvatski naziv sastojka je gotovo uvijek pridjev(i) + glavna imenica na
  // kraju ("mljevena junetina", "integralna tjestenina", "crveni grah").
  // Bez ovoga generički pridjev sam po sebi zna "pogoditi" nepovezan
  // proizvod (npr. "mljevena" iz "mljevena junetina" pogodi "mljevena
  // kava") čak i kad prava imenica nigdje ne postoji - zato imenica MORA
  // imati stvarnu vezu, pridjevi samo pomažu u rangiranju among kandidata.
  const headWord = queryWords[queryWords.length - 1];

  const candidates: { entry: IndexedProduct; score: number }[] = [];
  for (const entry of index) {
    if (wordScore(headWord, entry.normalizedName) === 0) continue;
    const score = queryWords.reduce((sum, w) => sum + wordScore(w, entry.normalizedName), 0);
    if (score > 0) candidates.push({ entry, score });
  }
  if (candidates.length === 0) return null;

  // Rangiranje: prvo tko ima jaču/više riječi poklopljenih (rješava i
  // "riža" zakopanu u dugom nazivu čokoladice - ta bi imala isti score kao
  // doslovna "Riža XXL" ali dulji naziv gubi na sljedećem kriteriju), pa
  // kraći/doslovniji naziv, pa cijena kao zadnji kriterij (kako spec traži
  // kod pravih sličnih kandidata).
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const lengthDiff = a.entry.normalizedName.length - b.entry.normalizedName.length;
    if (lengthDiff !== 0) return lengthDiff;
    return a.entry.product.price - b.entry.product.price;
  });

  return candidates[0].entry.product;
}

function convertToBasis(
  quantity: number,
  unit: string,
  basis: "kg" | "l" | "kom"
): number | null {
  // Mnoge namirnice unesene u gramima su zapravo tekuće/pasirane (npr.
  // pasirana rajčica, mlijeko) i prodaju se po litri, i obrnuto - zato
  // dopuštamo g<->ml pretvorbu uz pretpostavku gustoće ~1 (uobičajena
  // kuharska aproksimacija), umjesto da tu odustanemo i padnemo na
  // cijenu cijelog pakiranja.
  if (basis === "kg") {
    if (unit === "g" || unit === "ml") return quantity / 1000;
    if (unit === "kg" || unit === "l") return quantity;
    return null;
  }
  if (basis === "l") {
    if (unit === "ml" || unit === "g") return quantity / 1000;
    if (unit === "l" || unit === "kg") return quantity;
    return null;
  }
  if (basis === "kom") {
    return unit === "kom" ? quantity : null;
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type PriceEstimate = {
  price: number;
  /** Koliko cijelih pakiranja treba kupiti da se pokrije potrebna količina -
   * ne može se kupiti pola pakiranja tjestenine ili ulja u dućanu. */
  packages: number;
  /** false kad smo morali nagađati (nema pouzdane veličine pakiranja/baze
   * jedinice) pa je prikazana samo cijena jednog pakiranja. */
  exact: boolean;
};

export function calculateItemPrice(
  ingredient: { quantity: number; unit: string },
  product: ProductForMatching
): PriceEstimate {
  // Proizvod je zapakiran u fiksnu veličinu (net_quantity, u istoj bazi kao
  // unit: kg ili l) - kupuje se u cijelim pakiranjima, ne po proporciji
  // (za 250g tjestenine u pakiranju od 500g treba kupiti 1 cijelo pakiranje,
  // ne pola cijene).
  if ((product.unit === "kg" || product.unit === "l") && product.net_quantity) {
    const neededInBasis = convertToBasis(ingredient.quantity, ingredient.unit, product.unit);
    if (neededInBasis !== null) {
      const packages = Math.max(1, Math.ceil(neededInBasis / product.net_quantity));
      return { price: round2(packages * product.price), packages, exact: true };
    }
  }

  return { price: round2(product.price), packages: 1, exact: false };
}
