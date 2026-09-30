import { isFoodProduct, matchPrimaryCandidates, type ProductIndex } from "@/lib/matching";
import { splitFrozenRequest } from "@/lib/normalize";
import type { ProductForMatching } from "@/lib/products";

export type UnitBasis = "kg" | "l" | "kom";

/**
 * "cheapest" - najjeftiniji proizvod (na vagu: najjeftiniji €/kg).
 * "average" - samo za proizvode na vagu (npr. sirovo meso): prosjek €/kg svih
 * varijanti u referentnom skupu (file, s kosti, s kožom). Pakirani proizvodi
 * se uvijek biraju po najjeftinijem - prosjek miješa standardne i premium
 * proizvode (sol, ulje, začini) i daje nerealne cijene.
 */
export type PricingMode = "cheapest" | "average";

/**
 * Ručno pravilo za jedan sastojak (vidi `config/ingredient-rules.ts`).
 * `include`/`exclude` se testiraju nad normaliziranim nazivom proizvoda
 * (`normalizeProductName`). Sastojak bez pravila ide kroz generičko
 * uparivanje i u UI-u je označen kao "procjena".
 */
export type PricingRule = {
  key: string;
  label: string;
  /** Normalizirani nazivi sastojaka (bez dijakritika) koje ovo pravilo pokriva, uključujući sinonime. */
  aliases: string[];
  include: RegExp;
  exclude?: RegExp;
  mode: PricingMode;
  /** Sastojak se u trgovini prodaje i na vagu (povrće, meso) - smije se računati proporcionalno po kg. */
  looseOk: boolean;
  /**
   * Svježe povrće: prvo se traže proizvodi koji nisu smrznuti; smrznuti se
   * koriste samo ako svježeg nema (npr. grašak, špinat).
   */
  fresh?: boolean;
  /** Recept je izričito tražio smrznuto ("smrznuti grašak") - samo smrznuti proizvodi. */
  requireFrozen?: boolean;
};

export type RuleResolver = (ingredientName: string) => PricingRule | undefined;

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

/** Osnova u kojoj se računa potreba: masa (g/kg), volumen (ml/l) ili komadi. */
export function basisForUnit(unit: string): UnitBasis | null {
  if (unit === "g" || unit === "kg") return "kg";
  if (unit === "ml" || unit === "l") return "l";
  if (unit === "kom") return "kom";
  return null;
}

// ---------------------------------------------------------------------------
// Veličina pakiranja i "na vagu" prepoznavanje iz cjenika
// ---------------------------------------------------------------------------

// Izričita veličina u nazivu: "500 g", "1kg", "0,75L", "6 kom", "4x125g", "6/1".
// Iza jedinice se ne traži \b nego "nije slovo": nazivi poput "1 kg_OC" ili
// "cca600g" imaju podvlaku/broj uz jedinicu, što \b ne smatra granicom riječi.
const EXPLICIT_SIZE = /\d\s?(?:g|kg|dag|ml|cl|dl|l)(?![a-z])|\d\s?kom(?![a-z])|\d\s?x\s?\d|\d+\s?\/\s?1(?!\d)/i;
// Izričite oznake da je cijena po kg, a ne po pakiranju ("rinfuza", "cca 500g", "cca600g").
const LOOSE_CUE = /rinfuz|\bcca(?![a-z])|\bca\./i;

/**
 * `net_quantity` je u stvarnim cjenicima uvijek MASA u kg, čak i za tekućine
 * (audit N8) - npr. ulje "500 ml" ima 0,458. Za volumen zato prvo čitamo
 * izričitu veličinu iz naziva; masa je samo fallback (gustoća ~1).
 */
function volumeFromName(name: string): number | null {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l)(?![a-z])/i);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  const unit = m[2].toLowerCase();
  if (!(value > 0)) return null;
  return unit === "l" ? value : unit === "dl" ? value / 10 : unit === "cl" ? value / 100 : value / 1000;
}

/**
 * Broj komada u pakiranju za "kom" proizvode vadimo iz NAZIVA jer
 * `net_quantity` u cjeniku za te proizvode nije broj komada nego masa
 * pakiranja u kg (audit N8 - npr. jaja "6/1" imaju net_quantity=0.39).
 */
function packageCountFromName(name: string): number | null {
  const slash = name.match(/(\d+)\s*\/\s*1(?!\d)/);
  if (slash) return Number(slash[1]);
  const kom = name.match(/(\d+)\s*kom/i);
  if (kom) return Number(kom[1]);
  return null;
}

function packSizeOf(product: ProductForMatching, basis: UnitBasis): number | null {
  const nq = product.net_quantity !== null && product.net_quantity > 0 ? product.net_quantity : null;
  if (basis === "kom") return packageCountFromName(product.name);
  if (basis === "kg") return nq;
  return volumeFromName(product.name) ?? (product.unit === "l" ? nq : null);
}

/**
 * `net_quantity = 1` je dvosmislen: pravo pakiranje od 1 kg ili nominalna
 * oznaka za artikl koji se prodaje na vagu (cijena je tada po kg, ne po
 * pakiranju - npr. Lidl "Svježa pileća prsa cca 500g" 5,99, Kaufland
 * "Mrkva_OC" 0,89). Na vagu se računa samo uz izričitu oznaku u nazivu
 * ("rinfuza", "cca") ili, za sastojke koje pravilo označi kao `looseOk`,
 * kad naziv uopće ne navodi veličinu ili kad trgovina prijavi unit = kg s
 * unit_price = cijena.
 */
function isSoldByWeight(product: ProductForMatching, looseOk: boolean): boolean {
  // Lidl artikl koji izričito prijavljuje cijenu po kg (unit = kg) s
  // unit_price jednakim cijeni, a net_quantity je samo procijenjena težina
  // komada (npr. "Tikvica" 1,69 €/kg, net_quantity 0,3). Lidlovo unit = kom
  // znači cijenu po KOMADU (cvjetača, salate, krastavac) - to ostaje pakiranje.
  if (
    looseOk &&
    product.unit === "kg" &&
    product.unit_price !== null &&
    product.net_quantity !== null &&
    product.net_quantity < 1 &&
    Math.abs(product.unit_price - product.price) < 0.005
  ) {
    return true;
  }
  if (product.net_quantity !== 1) return false;
  if (LOOSE_CUE.test(product.name)) return true;
  return looseOk && !EXPLICIT_SIZE.test(product.name);
}

// ---------------------------------------------------------------------------
// Ponude (jedan proizvod = jedna ponuda) i odabir
// ---------------------------------------------------------------------------

type PackOffer = {
  kind: "pack";
  product: ProductForMatching;
  packSize: number;
  packCount: number;
  purchased: number; // packCount x packSize
  cost: number;
};

type LooseOffer = {
  kind: "loose";
  product: ProductForMatching;
  pricePerKg: number;
};

type Offer = PackOffer | LooseOffer;

// Među pakiranjima do ovog višekratnika najmanje veličine koja pokriva
// potrebu odlučuje cijena (npr. 20 g i 17 g začina, 250 ml i 458 ml ulja -
// veće pakiranje je često jeftinije od premium malog). Veće od toga se ne
// bira jer bi značilo kupiti puno više nego što treba.
const SIZE_TIER_FACTOR = 2;

/**
 * `curated` = sastojak ima ručno pravilo. Tada pravilo jamči da proizvod nije
 * na vagu (`looseOk: false`), pa `net_quantity = 1` bez veličine u nazivu
 * ("Riža dugozrnata 5% loma") je pravo pakiranje od 1 kg. Bez pravila to
 * ostaje nejasno i proizvod se preskače.
 */
function buildOffers(
  products: ProductForMatching[],
  basis: UnitBasis,
  need: number,
  looseOk: boolean,
  curated: boolean
): Offer[] {
  const offers: Offer[] = [];
  for (const product of products) {
    if (!(product.price > 0)) continue;

    if (basis === "kg" && isSoldByWeight(product, looseOk)) {
      offers.push({ kind: "loose", product, pricePerKg: product.price });
      continue;
    }
    // Veličinu pakiranja koju ne možemo pouzdano odrediti ne nagađamo -
    // proizvod se preskače (cjenik s nejasnim "1" i bez veličine u nazivu).
    if (product.net_quantity === 1 && !EXPLICIT_SIZE.test(product.name) && !(curated && !looseOk)) continue;

    const packSize = packSizeOf(product, basis);
    if (packSize === null) continue;
    const packCount = Math.max(1, Math.ceil(need / packSize - 1e-9));
    offers.push({ kind: "pack", product, packSize, packCount, purchased: packCount * packSize, cost: packCount * product.price });
  }
  return offers;
}

function displayName(product: ProductForMatching): string {
  return product.brand && product.brand !== "#" ? `${product.name} (${product.brand})` : product.name;
}

export type PurchaseResult = {
  basis: UnitBasis;
  neededQuantity: number; // u osnovi (kg/l/kom)
  /** Stvarno kupljena količina: cijela pakiranja (>= potrebno) ili, na vagu, točno potrebno. */
  purchaseQuantity: number;
  /** null kad se kupuje na vagu. */
  packCount: number | null;
  packSize: number | null;
  /** Višak koji ostaje nakon kupnje (purchaseQuantity - neededQuantity), gubitak. */
  surplus: number;
  soldByWeight: boolean;
  /** Samo na vagu: €/kg korišten za izračun (najjeftiniji ili prosjek varijanti). */
  pricePerKg: number | null;
};

export type PartPriceResult = {
  name: string;
  /** Naziv (+ marka) odabranog proizvoda; null kad je cijena prosjek više proizvoda ili nedostupna. */
  matchedName: string | null;
  /** Koliko je proizvoda ušlo u razmatranje (nakon filtara i dedupliciranja). */
  offerCount: number;
  /** Koliko je varijanti ušlo u prosjek (1 = nije prosjek). */
  averagedCount: number;
  /** true = sastojak nema ručno pravilo, pa je cijena generička procjena. */
  estimated: boolean;
  /** true = odabran je smrznuti proizvod (recept ga traži ili svježeg nema). */
  frozen: boolean;
  purchase: PurchaseResult | null;
  /** Cijena kupnje, zaokružena na 2 decimale. null = cijena nedostupna. */
  itemPrice: number | null;
};

function unavailable(name: string, offerCount: number, estimated: boolean): PartPriceResult {
  return { name, matchedName: null, offerCount, averagedCount: 0, estimated, frozen: false, purchase: null, itemPrice: null };
}

type Candidate = { product: ProductForMatching; normalizedName: string };

// Smrznuto se prepoznaje po nazivu i po marki (Lidl Freshona/Chira, Kaufland
// Ledo); dio Kauflandovog smrznutog nije ničim označen - njega hvata to što
// artikl na vagu ima prednost pred pakiranjem.
const FROZEN_NAME = /smrz|zamrz|\bledo\b|frozen|duboko|\biglo\b/;
const FROZEN_BRAND = /freshona|ledo|chira|iglo|findus|frozy/i;

function isFrozen(c: Candidate): boolean {
  return FROZEN_NAME.test(c.normalizedName) || (c.product.brand !== null && FROZEN_BRAND.test(c.product.brand));
}

function candidatesForIngredient(index: ProductIndex, name: string, rule: PricingRule | undefined): Candidate[] {
  if (!rule) return matchPrimaryCandidates(index, name);
  return index.filter(
    (e) =>
      isFoodProduct(e.product) &&
      rule.include.test(e.normalizedName) &&
      !(rule.exclude && rule.exclude.test(e.normalizedName))
  );
}

/**
 * Cijena jednog (nesloženog) sastojka. Pravila odabira:
 * 1. Sastojak koji se prodaje na vagu (`looseOk`) računa se proporcionalno po
 *    kg - to je jedini izuzetak od cijelih pakiranja.
 * 2. Inače se kupuje CIJELO pakiranje: najmanja veličina koja jednim
 *    pakiranjem pokriva potrebu, a među jednakim veličinama najjeftinije.
 *    Višak je gubitak i prikazuje se.
 * 3. Ako nijedno jedno pakiranje ne pokriva potrebu, kupuje se N istih
 *    pakiranja (najmanja ukupna kupljena količina, pa najjeftinije).
 * 4. Nikad proporcija pakiranja, nikad prosjek pakiranja, nikad izmišljena
 *    veličina - bez pouzdanog podatka cijena je nedostupna.
 */
export function priceIngredientPart(
  index: ProductIndex,
  name: string,
  quantity: number,
  unit: string,
  rule?: PricingRule
): PartPriceResult {
  const estimated = !rule;
  const basis = basisForUnit(unit);
  if (!basis || !(quantity > 0)) return unavailable(name, 0, estimated);
  const need = convertToBasis(quantity, unit, basis);
  if (need === null) return unavailable(name, 0, estimated);

  // Svježe ima prednost; smrznuto samo kad ga recept izričito traži ili kad
  // svježeg nema. Sastojci s ručnim pravilom bez `fresh` (meso, začini, riža)
  // ne filtriraju smrznuto.
  const query = splitFrozenRequest(name);
  const frozenRequested = query.frozen || (rule?.requireFrozen ?? false);
  const candidates = candidatesForIngredient(index, query.cleaned, rule);
  const frozenOnes = candidates.filter(isFrozen);
  const pools: Array<{ pool: Candidate[]; frozen: boolean }> = frozenRequested
    ? [{ pool: frozenOnes, frozen: true }]
    : rule && !rule.fresh
      ? [{ pool: candidates, frozen: false }]
      : [
          { pool: candidates.filter((c) => !isFrozen(c)), frozen: false },
          { pool: frozenOnes, frozen: true },
        ];

  let offers: Offer[] = [];
  let usedFrozen = false;
  for (const { pool, frozen } of pools) {
    // Smrznuto se nikad ne prodaje na vagu - vrećica od 1 kg je pakiranje.
    offers = buildOffers(pool.map((c) => c.product), basis, need, (rule?.looseOk ?? false) && !frozen, !estimated);
    if (offers.length > 0) {
      usedFrozen = frozen;
      break;
    }
  }
  if (offers.length === 0) return unavailable(name, 0, estimated);

  const loose = offers.filter((o): o is LooseOffer => o.kind === "loose");
  if (loose.length > 0) {
    const cheapest = loose.reduce((a, b) => (b.pricePerKg < a.pricePerKg ? b : a));
    const averaged = rule?.mode === "average" && loose.length > 1;
    const pricePerKg = averaged ? loose.reduce((sum, o) => sum + o.pricePerKg, 0) / loose.length : cheapest.pricePerKg;
    return {
      name,
      matchedName: averaged ? null : displayName(cheapest.product),
      offerCount: offers.length,
      averagedCount: averaged ? loose.length : 1,
      estimated,
      frozen: usedFrozen,
      purchase: {
        basis,
        neededQuantity: need,
        purchaseQuantity: need,
        packCount: null,
        packSize: null,
        surplus: 0,
        soldByWeight: true,
        pricePerKg,
      },
      itemPrice: round2(need * pricePerKg),
    };
  }

  const packs = offers.filter((o): o is PackOffer => o.kind === "pack");
  const singles = packs.filter((o) => o.packCount === 1);
  const pool = singles.length > 0 ? singles : packs;
  const smallest = Math.min(...pool.map((o) => o.purchased));
  const tier = pool.filter((o) => o.purchased <= smallest * SIZE_TIER_FACTOR);
  const best = tier.reduce((a, b) => (b.cost < a.cost ? b : a));

  return {
    name,
    matchedName: displayName(best.product),
    offerCount: offers.length,
    averagedCount: 1,
    estimated,
    frozen: usedFrozen,
    purchase: {
      basis,
      neededQuantity: need,
      purchaseQuantity: best.purchased,
      packCount: best.packCount,
      packSize: best.packSize,
      surplus: best.purchased - need,
      soldByWeight: false,
      pricePerKg: null,
    },
    itemPrice: round2(best.cost),
  };
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
// Spajanje sinonima prije cijenjenja
// ---------------------------------------------------------------------------

type MergeableItem = { name: string; quantity: number; unit: string };

/**
 * Popis za kupovinu spaja samo ISTE nazive, pa sinonimi iz različitih
 * recepata ostaju zasebni retci ("Papar" 5 g + "Biber" 10 g, "Piletina"
 * 500 g + "Pileća prsa" 500 g) i svaki bi kupio vlastito pakiranje. Retci
 * koje pokriva isto pravilo spajaju se u jedan (količine u istoj osnovi se
 * zbrajaju) i prikazuju pod nazivom pravila. Sastojci bez pravila i retci
 * koji se ne mogu spojiti (nespojive jedinice) ostaju netaknuti.
 */
export function mergeItemsByRule<T extends MergeableItem>(items: T[], ruleFor: RuleResolver): T[] {
  type Group = { rule: PricingRule; basis: UnitBasis; members: T[] };
  const groups = new Map<string, Group>();
  const result: Array<T | Group> = [];

  for (const item of items) {
    const rule = ruleFor(item.name);
    const basis = basisForUnit(item.unit);
    if (!rule || !basis) {
      result.push(item);
      continue;
    }
    const key = `${rule.key}|${basis}`;
    let group = groups.get(key);
    if (!group) {
      group = { rule, basis, members: [] };
      groups.set(key, group);
      result.push(group);
    }
    group.members.push(item);
  }

  return result.map((entry) => {
    if (!("members" in entry)) return entry;
    const { rule, basis, members } = entry;
    const distinctNames = new Set(members.map((m) => m.name.trim().toLowerCase()));
    const distinctUnits = new Set(members.map((m) => m.unit));
    if (members.length === 1) return members[0];
    if (distinctNames.size === 1 && distinctUnits.size === 1) return members[0]; // već spojeno u popisu

    if (basis === "kom") {
      const quantity = members.reduce((sum, m) => sum + m.quantity, 0);
      return { ...members[0], name: rule.label, quantity };
    }
    // g+kg / ml+l: zbroji u najmanjoj jedinici (g/ml) da nema izmjena preciznosti.
    const smallUnit = basis === "kg" ? "g" : "ml";
    const quantity = members.reduce((sum, m) => sum + (convertToBasis(m.quantity, m.unit, basis) ?? 0) * 1000, 0);
    return { ...members[0], name: rule.label, quantity: Math.round(quantity * 1000) / 1000, unit: smallUnit };
  });
}

// ---------------------------------------------------------------------------
// Redak košarice
// ---------------------------------------------------------------------------

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
  item: { name: string; quantity: number; unit: string },
  ruleFor: RuleResolver = () => undefined
): BasketLineResult {
  const { parts: nameParts, mode } = splitCompoundIngredientName(item.name);

  if (mode === "single") {
    const part = priceIngredientPart(index, item.name, item.quantity, item.unit, ruleFor(item.name));
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
    const parts = nameParts.map((p) => priceIngredientPart(index, p, share, item.unit, ruleFor(p)));
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
  const parts = nameParts.map((p) => priceIngredientPart(index, p, item.quantity, item.unit, ruleFor(p)));
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
