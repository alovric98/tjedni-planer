import { matchProductCandidates, type ProductIndex } from "@/lib/matching";
import type { ProductForMatching } from "@/lib/products";

export type UnitBasis = "kg" | "l" | "kom";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pretvara količinu sastojka (iz recepta, u g/kg/ml/l/kom) u zajedničku
 * osnovu (kg/l/kom) proizvoda kojeg uspoređujemo. g<->ml pretvorba
 * pretpostavlja gustoću 1 (uobičajena kuharska aproksimacija za sastojke
 * poput pasirane rajčice ili mlijeka) - vidi audit N8.
 */
export function convertToBasis(quantity: number, unit: string, basis: UnitBasis): number | null {
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
  return unit === "kom" ? quantity : null; // basis === "kom"
}

// ---------------------------------------------------------------------------
// FIX 1 - prosječna jedinična cijena preko svih kandidata iznad praga
// ---------------------------------------------------------------------------

type CandidateUnitPrice = {
  product: ProductForMatching;
  basis: UnitBasis;
  unitPrice: number; // € po kg / l / kom
};

/**
 * Jedinična cijena JEDNOG kandidata, u njegovoj vlastitoj osnovi.
 * Prioritet: `unit_price` iz cjenika (trgovina ga sama izračuna iz
 * deklarirane veličine na ambalaži i pouzdaniji je), zatim price/net_quantity
 * kad je barem `unit` poznat. `net_quantity` je u stvarnim cjenicima uvijek
 * MASA u kg, čak i za tekućine i "kom" proizvode (audit N8) - to unosi mali
 * sustavni error za tekućine (~8% za ulje, gustoća ≠ 1) kad se koristi kao
 * fallback, ali je jedini dostupan podatak kad `unit_price` nedostaje.
 * Kandidat bez ijednog pouzdanog izvora vraća null i NE ulazi u prosjek.
 */
function unitPriceOfCandidate(product: ProductForMatching): CandidateUnitPrice | null {
  const basis = product.unit as UnitBasis | null;
  if (!basis) return null;
  if (product.unit_price !== null && product.unit_price > 0) {
    return { product, basis, unitPrice: product.unit_price };
  }
  if (product.net_quantity !== null && product.net_quantity > 0) {
    return { product, basis, unitPrice: product.price / product.net_quantity };
  }
  return null;
}

export type AveragePriceResult = {
  basis: UnitBasis | null;
  /** Koliko je kandidata ušlo u prosjek (nakon grupiranja po osnovi). */
  pricedCount: number;
  /** Konačna jedinična cijena - pojedinačna, aritmetička sredina ili trimmed mean. */
  unitPrice: number | null;
  /** true kad se prikazuje oznaka "prosjek N proizvoda" (pricedCount > 1). */
  usedAverage: boolean;
  min: number | null;
  max: number | null;
  /** Koliko je vrijednosti odsječeno kao outlier (trimmed mean). */
  trimmedOutCount: number;
};

/**
 * FIX 1, korak 2 - odabrana mjera: TRIMMED MEAN (odsječeno 10% s oba kraja,
 * zaokruženo prema dolje, za n<=4 obična aritmetička sredina jer uzorak nije
 * dovoljno velik da odsijecanje ima smisla).
 *
 * Zašto trimmed mean, a ne obična sredina ili medijan: vlasnik je izričito
 * tražio "prosjek", pa je aritmetička sredina polazna točka - ali izmjereni
 * kandidati na stvarnom cjeniku pokazuju da jedan pogrešno uparen proizvod
 * zna biti 10-30x skuplji od stvarne namirnice (audit: Nivea losion
 * 30,98 €/l usred pravog mlijeka ~1 €/l), pa bi ga obična sredina teško
 * iskrivila. Medijan bi za mali broj kandidata (2-4) odbacio i legitimnu
 * razliku između jeftinije i skuplje marke, što nije poanta "prosjeka".
 * Trimmed mean zadržava traženi "prosjek" i pravi raspon marki, a odsijeca
 * samo ekstreme koji bi dominirali običnu sredinu - uz prag i kategorijski
 * filtar iz matching.ts broj takvih ekstrema je već malen.
 */
export function computeAveragePrice(candidates: CandidateUnitPrice[]): AveragePriceResult {
  if (candidates.length === 0) {
    return { basis: null, pricedCount: 0, unitPrice: null, usedAverage: false, min: null, max: null, trimmedOutCount: 0 };
  }

  const basis = candidates[0].basis;
  const prices = candidates.map((c) => c.unitPrice).sort((a, b) => a - b);
  const min = prices[0];
  const max = prices[prices.length - 1];

  if (prices.length === 1) {
    return { basis, pricedCount: 1, unitPrice: prices[0], usedAverage: false, min, max, trimmedOutCount: 0 };
  }

  let sample = prices;
  let trimmedOutCount = 0;
  if (prices.length > 4) {
    // 10% po strani, ali minimalno 1 s obje strane - kod tipičnih 5-9
    // kandidata floor(10%) daje 0 i outlier (npr. Nivea losion) uopće ne bi
    // bio odsječen, što poništava cijelu svrhu trimmed meana baš u
    // najčešćem rasponu (audit: "mlijeko" 260 kandidata je rijetkost, 5-8
    // stvarnih varijanti marke je tipično). Za veće uzorke (n>=10) ovo se
    // svodi na točnih 10% po strani.
    const perSide = Math.max(1, Math.floor(prices.length * 0.1));
    sample = prices.slice(perSide, prices.length - perSide);
    trimmedOutCount = prices.length - sample.length;
  }

  const unitPrice = sample.reduce((sum, p) => sum + p, 0) / sample.length;
  return { basis, pricedCount: prices.length, unitPrice, usedAverage: true, min, max, trimmedOutCount };
}

// ---------------------------------------------------------------------------
// FIX 2 - zaokruživanje na stvarna kupovna pakiranja
// ---------------------------------------------------------------------------

export type PackageBreakdown = { size: number; count: number };

export type PurchaseResult = {
  basis: UnitBasis;
  neededQuantity: number; // u osnovi (kg/l/kom)
  purchaseQuantity: number; // >= neededQuantity, stvarna količina za kupnju
  packages: PackageBreakdown[];
  /** true kad su korištene DEFAULT_PACKAGE_SIZES pretpostavke jer cjenik nije dao pouzdanu veličinu. */
  packageSizeAssumed: boolean;
};

/**
 * FIX 2, korak 1.3 - zadane veličine pakiranja kad cjenik ne daje pouzdan
 * podatak (proizvod bez `unit`/`net_quantity`, ili "kom" proizvod bez broja
 * komada u nazivu). OVO JE EKSPLICITNA PRETPOSTAVKA, ne stvaran podatak iz
 * cjenika - zamijeniti čim se nađe pouzdaniji izvor (npr. barkod baza).
 * Prepoznavanje kategorije je namjerno grubo, po ključnoj riječi u nazivu
 * sastojka, jer cjenik ne daje dosljednu potkategoriju po namirnici (samo
 * široku HRANA/PIĆE/... podjelu - vidi matching.ts).
 */
const DEFAULT_PACKAGE_SIZES: { match: RegExp; basis: UnitBasis; sizes: number[] }[] = [
  { match: /mlijek|sok|ulje|napitak|voda/i, basis: "l", sizes: [0.5, 1, 2] },
  { match: /braš|šeć|riž/i, basis: "kg", sizes: [0.5, 1, 2, 5] },
  { match: /jaj/i, basis: "kom", sizes: [6, 10] },
];

function defaultPackageSizes(ingredientName: string, basis: UnitBasis): number[] {
  const rule = DEFAULT_PACKAGE_SIZES.find((r) => r.basis === basis && r.match.test(ingredientName));
  if (rule) return rule.sizes;
  // Nema specifičnog pravila za ovu namirnicu - pretpostavljamo JEDNO
  // "standardno" pakiranje. Nikad ne izmišljamo manje pakiranje od stvarnog
  // (to bi moglo podcijeniti potrebnu kupnju) - UI to označava kao pretpostavku.
  return [1];
}

/**
 * Broj komada u pakiranju za "kom" proizvode vadimo iz NAZIVA jer
 * `net_quantity` u cjeniku za te proizvode nije broj komada nego masa
 * pakiranja u kg (audit N8 - npr. jaja "6/1" imaju net_quantity=0.39).
 */
function packageCountFromName(name: string): number | null {
  const slash = name.match(/(\d+)\s*\/\s*1\b/);
  if (slash) return Number(slash[1]);
  const kom = name.match(/(\d+)\s*kom/i);
  if (kom) return Number(kom[1]);
  return null;
}

function packageSizeOfProduct(product: ProductForMatching, basis: UnitBasis): number | null {
  if (basis === "kom") return packageCountFromName(product.name);
  if (product.unit === basis && product.net_quantity && product.net_quantity > 0) {
    return product.net_quantity;
  }
  return null;
}

function resolvePackageSizes(
  products: ProductForMatching[],
  basis: UnitBasis,
  ingredientName: string
): { sizes: number[]; assumed: boolean } {
  const real = Array.from(
    new Set(
      products
        .map((p) => packageSizeOfProduct(p, basis))
        .filter((n): n is number => n !== null && n > 0)
    )
  ).sort((a, b) => a - b);

  if (real.length > 0) return { sizes: real, assumed: false };
  return { sizes: defaultPackageSizes(ingredientName, basis), assumed: true };
}

/**
 * FIX 2, korak 2 - najmanja kombinacija pakiranja koja PREKRIVA potrebnu
 * količinu, zaokruženo prema gore, nikad prema dolje. Budući da je
 * jedinična cijena (Fix 1) ista bez obzira na veličinu odabranog pakiranja
 * (real per-pakiranje cijene se ne koriste, samo prosječna jedinična
 * cijena x kupovna količina), "najjeftinija kombinacija" se svodi na
 * "najmanja ukupna kupovna količina" - to je jedini stvaran zahtjev iz
 * briefa (nikad manje od potrebnog) i jedino mjerljivo bez stvarnih
 * cijena po pakiranju. Implementirano kao standardni "coin change" (DP) nad
 * dostupnim veličinama pakiranja - radi u tisućinkama (g/ml/kom x1000) da
 * izbjegnemo greške decimalnog zbrajanja.
 */
export function calculatePurchaseQuantity(
  needed: number,
  sizes: number[]
): { purchaseQuantity: number; packages: PackageBreakdown[] } {
  const SCALE = 1000;
  const sizesInt = Array.from(new Set(sizes.map((s) => Math.round(s * SCALE)))).filter((s) => s > 0);
  if (sizesInt.length === 0 || needed <= 0) {
    return { purchaseQuantity: needed, packages: [] };
  }

  const neededInt = Math.max(1, Math.ceil(needed * SCALE));
  const maxSize = Math.max(...sizesInt);
  const upperBound = neededInt + maxSize;

  const minCount = new Array<number>(upperBound + 1).fill(Infinity);
  const lastSize = new Array<number>(upperBound + 1).fill(-1);
  minCount[0] = 0;
  for (let s = 1; s <= upperBound; s++) {
    for (const size of sizesInt) {
      if (size <= s && minCount[s - size] + 1 < minCount[s]) {
        minCount[s] = minCount[s - size] + 1;
        lastSize[s] = size;
      }
    }
  }

  let chosenSum = -1;
  for (let s = neededInt; s <= upperBound; s++) {
    if (minCount[s] !== Infinity) {
      chosenSum = s;
      break;
    }
  }

  // Nijedna kombinacija do gornje granice ne pokriva potrebno (samo teoretski
  // moguće uz jako neobične veličine) - vrati jedno najveće dostupno
  // pakiranje kao najbolju raspoloživu aproksimaciju; nikad manje od njega.
  if (chosenSum === -1) {
    return { purchaseQuantity: maxSize / SCALE, packages: [{ size: maxSize / SCALE, count: 1 }] };
  }

  const counts = new Map<number, number>();
  let s = chosenSum;
  while (s > 0) {
    const size = lastSize[s];
    counts.set(size, (counts.get(size) ?? 0) + 1);
    s -= size;
  }

  const packages = Array.from(counts.entries())
    .map(([size, count]) => ({ size: size / SCALE, count }))
    .sort((a, b) => b.size - a.size);

  return { purchaseQuantity: chosenSum / SCALE, packages };
}

// ---------------------------------------------------------------------------
// Složeni sastojci ("mrkva i celer", "kiselo vrhnje ili grčki jogurt") -
// audit N5: dosadašnji matcher uzima samo zadnju riječ naziva kao nositelja,
// pa prvi dio ovakvih naziva nikad ne uđe u izračun.
// ---------------------------------------------------------------------------

export type CompoundMode = "single" | "and" | "or";

export function splitCompoundIngredientName(name: string): { parts: string[]; mode: CompoundMode } {
  const orParts = name.split(/\s+ili\s+/i).map((p) => p.trim()).filter(Boolean);
  if (orParts.length > 1) return { parts: orParts, mode: "or" };

  const andParts = name.split(/\s+i\s+/i).map((p) => p.trim()).filter(Boolean);
  if (andParts.length > 1) return { parts: andParts, mode: "and" };

  return { parts: [name], mode: "single" };
}

// ---------------------------------------------------------------------------
// Orkestracija po dijelu sastojka: kandidati (matching.ts) -> prosjek (Fix 1)
// -> kupovna količina (Fix 2) -> cijena. Redoslijed je obavezan po specu.
// ---------------------------------------------------------------------------

export type PartPriceResult = {
  name: string;
  /** Naziv (+ marka) prikazanog proizvoda - postavljen SAMO kad je pricedCount === 1. */
  matchedName: string | null;
  matchCandidateCount: number; // svi kandidati iznad praga sličnosti (prije filtriranja po osnovi/cijeni)
  averagePrice: AveragePriceResult;
  purchase: PurchaseResult | null;
  /** averagePrice.unitPrice x purchase.purchaseQuantity, zaokruženo na 2 decimale. null = cijena nedostupna. */
  itemPrice: number | null;
};

function priceUnavailable(name: string, matchCandidateCount: number, avg: AveragePriceResult): PartPriceResult {
  return { name, matchedName: null, matchCandidateCount, averagePrice: avg, purchase: null, itemPrice: null };
}

export function priceIngredientPart(index: ProductIndex, name: string, quantity: number, unit: string): PartPriceResult {
  const matched = matchProductCandidates(index, name);
  const priced = matched
    .map((c) => unitPriceOfCandidate(c.product))
    .filter((p): p is CandidateUnitPrice => p !== null);

  // Kandidati moraju biti u ISTOJ osnovi (kg/l/kom) da bi ušli u isti
  // prosjek (spec: "kandidati s različitim osnovama isključeni iz prosjeka,
  // ne pomiješani") - grupiramo po osnovi i biramo najveću grupu; ostatak se
  // ne miješa u izračun.
  const groups = new Map<UnitBasis, CandidateUnitPrice[]>();
  for (const p of priced) {
    const arr = groups.get(p.basis) ?? [];
    arr.push(p);
    groups.set(p.basis, arr);
  }
  let chosenGroup: CandidateUnitPrice[] = [];
  for (const arr of groups.values()) {
    if (arr.length > chosenGroup.length) chosenGroup = arr;
  }

  const avg = computeAveragePrice(chosenGroup);
  if (!avg.basis || avg.unitPrice === null) {
    return priceUnavailable(name, matched.length, avg);
  }

  const neededInBasis = convertToBasis(quantity, unit, avg.basis);
  if (neededInBasis === null) {
    return priceUnavailable(name, matched.length, avg);
  }

  const { sizes, assumed } = resolvePackageSizes(
    chosenGroup.map((c) => c.product),
    avg.basis,
    name
  );
  const { purchaseQuantity, packages } = calculatePurchaseQuantity(neededInBasis, sizes);
  const itemPrice = round2(avg.unitPrice * purchaseQuantity);

  const representative = avg.pricedCount === 1 ? chosenGroup[0].product : null;
  const matchedName = representative
    ? representative.brand && representative.brand !== "#"
      ? `${representative.name} (${representative.brand})`
      : representative.name
    : null;

  return {
    name,
    matchedName,
    matchCandidateCount: matched.length,
    averagePrice: avg,
    purchase: { basis: avg.basis, neededQuantity: neededInBasis, purchaseQuantity, packages, packageSizeAssumed: assumed },
    itemPrice,
  };
}

export type BasketLineResult = {
  ingredient: string;
  quantity: number;
  unit: string;
  mode: CompoundMode;
  /** 1 dio za "single"/"or", svi dijelovi za "and". */
  parts: PartPriceResult[];
  /** Za "or" - koji je dio odabran (jeftiniji od cijenjenih); null ako nijedan nema cijenu. */
  chosenPartIndex: number | null;
  totalPrice: number | null;
  priceUnavailable: boolean;
  /** Za "and" - true kad je BAR JEDAN dio necijenjen, ali ostatak se ipak zbraja (ne izbacuje tiho cijeli redak). */
  partiallyUnavailable: boolean;
};

export function priceShoppingItem(
  index: ProductIndex,
  item: { name: string; quantity: number; unit: string }
): BasketLineResult {
  const { parts: nameParts, mode } = splitCompoundIngredientName(item.name);

  if (mode === "single") {
    const part = priceIngredientPart(index, item.name, item.quantity, item.unit);
    return {
      ingredient: item.name,
      quantity: item.quantity,
      unit: item.unit,
      mode,
      parts: [part],
      chosenPartIndex: part.itemPrice !== null ? 0 : null,
      totalPrice: part.itemPrice,
      priceUnavailable: part.itemPrice === null,
      partiallyUnavailable: false,
    };
  }

  if (mode === "and") {
    // Recept ne razdvaja koliko čega ide u "mrkva i celer" - dijelimo
    // potrebnu količinu ravnomjerno na broj dijelova. Najbolja dostupna
    // pretpostavka bez izmjene sheme recepata (audit N5); alternativa bi
    // bila prikazati oba dijela bez ikakve količine, što je gore.
    const share = item.quantity / nameParts.length;
    const parts = nameParts.map((p) => priceIngredientPart(index, p, share, item.unit));
    const priced = parts.filter((p) => p.itemPrice !== null);
    const totalPrice = priced.length > 0 ? round2(priced.reduce((sum, p) => sum + (p.itemPrice ?? 0), 0)) : null;
    return {
      ingredient: item.name,
      quantity: item.quantity,
      unit: item.unit,
      mode,
      parts,
      chosenPartIndex: null,
      totalPrice,
      priceUnavailable: totalPrice === null,
      partiallyUnavailable: priced.length > 0 && priced.length < parts.length,
    };
  }

  // mode === "or": cijeni obje alternative za punu količinu i odaberi
  // jeftiniju od onih koje uopće imaju cijenu (kupac uzima jedno ILI drugo).
  const parts = nameParts.map((p) => priceIngredientPart(index, p, item.quantity, item.unit));
  let chosenIndex: number | null = null;
  for (let i = 0; i < parts.length; i++) {
    const price = parts[i].itemPrice;
    if (price === null) continue;
    if (chosenIndex === null || price < (parts[chosenIndex].itemPrice as number)) chosenIndex = i;
  }
  return {
    ingredient: item.name,
    quantity: item.quantity,
    unit: item.unit,
    mode,
    parts,
    chosenPartIndex: chosenIndex,
    totalPrice: chosenIndex !== null ? parts[chosenIndex].itemPrice : null,
    priceUnavailable: chosenIndex === null,
    partiallyUnavailable: false,
  };
}
