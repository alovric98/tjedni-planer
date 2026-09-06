import Fuse from "fuse.js";
import { normalize } from "@/lib/normalize";
import type { ProductForMatching } from "@/lib/products";

type IndexedProduct = {
  product: ProductForMatching;
  normalizedName: string;
};

const MATCH_THRESHOLD = 0.4; // fuse.js score: 0 = savršen, 1 = nema veze
const CANDIDATE_WINDOW = 0.1; // kandidati unutar ovog raspona od najboljeg -> uzmi najjeftinijeg

export type ProductIndex = Fuse<IndexedProduct>;

export function buildProductIndex(products: ProductForMatching[]): ProductIndex {
  const indexed: IndexedProduct[] = products.map((product) => ({
    product,
    normalizedName: normalize(product.name),
  }));

  return new Fuse(indexed, {
    keys: ["normalizedName"],
    includeScore: true,
    threshold: 0.6,
    ignoreLocation: true,
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchProduct(index: ProductIndex, ingredientName: string): ProductForMatching | null {
  const query = normalize(ingredientName);
  const results = index.search(query);
  if (results.length === 0) return null;

  const bestScore = results[0].score ?? 1;
  if (bestScore > MATCH_THRESHOLD) return null;

  const candidates = results.filter((r) => (r.score ?? 1) <= bestScore + CANDIDATE_WINDOW);

  // Sirovi fuzzy match ne razlikuje "riža" kao cijelu riječ od "riža" zakopane
  // u puno dužem nazivu (npr. čokoladice) - zato dajemo prednost kandidatima
  // gdje je upit cijela riječ u nazivu, pa tek onda kraćem/doslovnijem nazivu,
  // a cijena je zadnji kriterij (kako spec traži kod pravih sličnih kandidata).
  const wordBoundary = new RegExp(`(^|\\s)${escapeRegExp(query)}(\\s|$)`);
  const wholeWordMatches = candidates.filter((c) => wordBoundary.test(c.item.normalizedName));
  const pool = wholeWordMatches.length > 0 ? wholeWordMatches : candidates;

  pool.sort((a, b) => {
    const lengthDiff = a.item.normalizedName.length - b.item.normalizedName.length;
    if (lengthDiff !== 0) return lengthDiff;
    return a.item.product.price - b.item.product.price;
  });

  return pool[0].item.product;
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
  /** false kad smo morali pasti natrag na cijenu cijelog pakiranja jer
   * nemamo pouzdanu jediničnu cijenu/bazu za traženu jedinicu mjere. */
  exact: boolean;
};

export function calculateItemPrice(
  ingredient: { quantity: number; unit: string },
  product: ProductForMatching
): PriceEstimate {
  if (product.unit && product.unit_price !== null) {
    const basis = product.unit as "kg" | "l" | "kom";
    const converted = convertToBasis(ingredient.quantity, ingredient.unit, basis);
    if (converted !== null) {
      return { price: round2(product.unit_price * converted), exact: true };
    }
  }
  return { price: round2(product.price), exact: false };
}
