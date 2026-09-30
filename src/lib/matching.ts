import { normalize } from "@/lib/normalize";
import { synonymsOf } from "@/lib/ingredient-synonyms";
import type { ProductForMatching } from "@/lib/products";

const STOPWORDS = new Set(["i", "u", "s", "sa", "za", "od", "na", "po", "te", "ili"]);

type IndexedProduct = {
  product: ProductForMatching;
  normalizedName: string;
};

export type ProductIndex = IndexedProduct[];

/**
 * Lidlov cjenik sadrži doslovne duplikate (isti naziv/marka/cijena/količina,
 * npr. "Mrkva 1kg" 6x - različiti barkodovi istog proizvoda) - provjereno
 * 30.9.2026: ~5000 od ~10 800 Lidlovih artikala hrane. Duplikat ne nosi novu
 * informaciju, a bez dedupliciranja bi težinski iskrivio svaki prosjek.
 */
function dedupeKey(p: ProductForMatching): string {
  return [p.name, p.brand, p.price, p.net_quantity].join("|");
}

export function buildProductIndex(products: ProductForMatching[]): ProductIndex {
  const seen = new Set<string>();
  const index: ProductIndex = [];
  for (const product of products) {
    const key = dedupeKey(product);
    if (seen.has(key)) continue;
    seen.add(key);
    index.push({
      product,
      // Kaufland/Lidl nazivi često spajaju riječi interpunkcijom bez razmaka
      // ("KLC.Tjestenina", "Naturel_OC") - to bi inače sakrilo prvu/zadnju
      // riječ od provjere granice riječi ispod.
      normalizedName: normalizeProductName(product.name),
    });
  }
  return index;
}

/** Naziv proizvoda u obliku u kojem ga matcher i pravila sastojaka uspoređuju. */
export function normalizeProductName(name: string): string {
  return normalize(name.replace(/[._\-\/,]+/g, " "));
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

const NEGATION_WORD = "bez";

/**
 * "Tjestenina bez jaja" ne smije brojati kao pogodak za upit "jaja" - "bez"
 * doslovno znači da sastojak NIJE u proizvodu, suprotno od onoga što tražimo.
 * Traži cijelu riječ upita neposredno iza "bez" (word-boundary na oba kraja),
 * ne samo substring - inače bi "bez" bilo koji drugi negiran sastojak
 * (npr. "bez laktoze") lažno poništio nepovezanu riječ koja se slučajno
 * pojavljuje negdje drugdje u istom nazivu.
 */
const negationRegexCache = new Map<string, RegExp>();
function negationRegex(word: string): RegExp {
  let re = negationRegexCache.get(word);
  if (!re) {
    re = new RegExp(`(^|\\s)${NEGATION_WORD}\\s+${escapeRegExp(word)}(\\s|$)`);
    negationRegexCache.set(word, re);
  }
  return re;
}

function isNegatedInTarget(word: string, target: string): boolean {
  return negationRegex(word).test(target);
}

/**
 * Bodovanje jedne riječi (ili njene regionalne sinonim-alternative, npr.
 * "biber" -> "papar") naspram naziva proizvoda:
 * 2 = stoji kao cijela riječ (npr. "luk" u "Luk 750g")
 * 1 = poklapa se korijen/prefiks riječi, otporno na jedninu/množinu i
 *     skraćene varijante ("tikvice" -> "tikvica", "integralna" -> "integralne")
 * 0 = nema stvarne veze, ILI riječ stoji u nazivu samo unutar negacije
 *     ("bez jaja") - vidi isNegatedInTarget
 * Riječi kraće od 3 znaka se ne boduju - premalo su specifične sam za sebe
 * i lako bi lažno pogodile nepovezan proizvod.
 */
function wordScore(word: string, target: string): number {
  if (word.length < 3) return 0;
  let best = 0;
  for (const candidate of [word, ...synonymsOf(word)]) {
    const score = wordScoreForLiteral(candidate, target);
    if (score > best) best = score;
  }
  return best;
}

/**
 * Stvarna provjera jedne doslovne riječi (bez sinonima) naspram naziva
 * proizvoda - dijeljena i za izvornu riječ upita i za svaku njenu
 * sinonim-alternativu, tako da "bez X" negacija (isNegatedInTarget) vrijedi
 * jednako za obje, a ne samo za izvornu riječ upita.
 */
const wordBoundaryRegexCache = new Map<string, RegExp>();
function wordBoundaryRegex(word: string): RegExp {
  let re = wordBoundaryRegexCache.get(word);
  if (!re) {
    re = new RegExp(`(^|\\s)${escapeRegExp(word)}(\\s|$)`);
    wordBoundaryRegexCache.set(word, re);
  }
  return re;
}

function wordScoreForLiteral(word: string, target: string): number {
  if (isNegatedInTarget(word, target)) return 0;
  if (wordBoundaryRegex(word).test(target)) return 2;
  const prefixLength = Math.min(word.length, Math.max(4, Math.ceil(word.length * 0.7)));
  return target.includes(word.slice(0, prefixLength)) ? 1 : 0;
}

// Kaufland/Lidl cjenik dijeli cijeli katalog na svega 6 širokih kategorija
// (HRANA, PIĆE, KOZMETIKA, PROIZVODI ZA KUĆANSTVO, SREDSTVA ZA ČIŠĆENJE,
// TOALETNE POTREPŠTINE - provjereno na stvarnom Kaufland cjeniku,
// 29.09.2026). Sastojci recepata su isključivo hrana i piće; bez ovog filtra
// "mlijeko" uparuje Nivea losion za tijelo (kategorija KOZMETIKA) jer riječ
// "mlijeko" doslovno stoji u nazivu kozmetičkog proizvoda (audit N1). Kad
// kategorija nedostaje (npr. nepotvrđeno Lidlovo polje, audit N19) ne
// filtriramo - bolje propustiti kandidata na provjeru praga nego ga tiho
// izgubiti zbog praznog polja. Usporedba je bez obzira na velika/mala slova:
// Kaufland šalje "HRANA", Lidl "Hrana" (inače bi svi Lidlovi proizvodi bili
// filtrirani i Košarica bi prikazivala "cijena nedostupna").
const FOOD_CATEGORIES = new Set(["HRANA", "PIĆE"]);

export function isFoodProduct(product: ProductForMatching): boolean {
  return !product.category || FOOD_CATEGORIES.has(product.category.toUpperCase());
}

/**
 * wordScore je odozgo neograničen brojem riječi upita (max 2 po riječi), pa
 * ga normaliziramo na 0-1 da prag ispod ima stvarno značenje "koliki dio
 * upita se poklapa", a ne apsolutni zbroj koji ovisi o duljini sastojka.
 */
function normalizedScore(queryWords: string[], target: string): number {
  const max = queryWords.length * 2;
  if (max === 0) return 0;
  const sum = queryWords.reduce((total, w) => total + wordScore(w, target), 0);
  return sum / max;
}

// Kalibrirano na stvarnom Kaufland cjeniku (15.358 proizvoda, 29.09.2026):
// 0.6 propušta prave sinonime i varijante marke (sve vrste trajnog/svježeg
// mlijeka za upit "mlijeko", sve vrste maslinovog ulja za "maslinovo ulje")
// dok odbacuje slabe pogotke gdje se poklopi samo jedan pridjev ili kratki
// prefiks. Slučaj kad kratka jednorječna namirnica (npr. "jaja") doslovno
// stoji u nazivu potpuno drugog proizvoda (npr. tjestenina "bez jaja") je
// riješen direktno u wordScore/isNegatedInTarget (negacijski filtar za
// "bez X" fraze), ne pragom - prag ostaje čisto mjera "koliki dio upita se
// poklapa". Ispod praga = kandidat se uopće ne broji, ni u prosjek ni u
// prikaz "N proizvoda".
export const MIN_MATCH_SIMILARITY = 0.6;

export type MatchCandidate = {
  product: ProductForMatching;
  score: number; // 0-1, normalizirani wordScore
  normalizedName: string;
};

/**
 * Vraća SVE kandidate iznad praga pouzdanosti (ne bira pobjednika) - FIX 1,
 * korak 0. `matchProduct` ispod je tanki wrapper zadržan zbog kompatibilnosti
 * postojećih poziva; stvarna logika cijene (cijela pakiranja, rinfuza,
 * odabir proizvoda) živi u `src/lib/pricing.ts`.
 */
export function matchProductCandidates(index: ProductIndex, ingredientName: string): MatchCandidate[] {
  const queryWords = queryWordsOf(ingredientName);
  if (queryWords.length === 0) return [];

  // Hrvatski naziv sastojka je gotovo uvijek pridjev(i) + glavna imenica na
  // kraju ("mljevena junetina", "integralna tjestenina", "crveni grah").
  // Bez ovoga generički pridjev sam po sebi zna "pogoditi" nepovezan
  // proizvod (npr. "mljevena" iz "mljevena junetina" pogodi "mljevena
  // kava") čak i kad prava imenica nigdje ne postoji - zato imenica MORA
  // imati stvarnu vezu, pridjevi samo pomažu u rangiranju among kandidata.
  const headWord = queryWords[queryWords.length - 1];

  const candidates: MatchCandidate[] = [];
  for (const entry of index) {
    if (wordScore(headWord, entry.normalizedName) === 0) continue;
    if (!isFoodProduct(entry.product)) continue;
    const score = normalizedScore(queryWords, entry.normalizedName);
    if (score >= MIN_MATCH_SIMILARITY) {
      candidates.push({ product: entry.product, score, normalizedName: entry.normalizedName });
    }
  }

  // Rangiranje samo za prikaz/reprezentativni naziv (kad je 1 kandidat) -
  // ne bira "pobjednika" za cijenu, to radi prosjek u pricing.ts. Najkraći
  // naziv je uklonjen kao kriterij (ranije birao "pobjednika" bez razloga,
  // audit N1) - ostaje samo score, pa cijena kao razrješenje ravnopravnih.
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.price - b.product.price;
  });

  return candidates;
}

// Prerađeni proizvodi u kojima sastojak stoji samo kao okus/dodatak ("Krekeri
// vrhnje luk", "Mrkva kolač", "Indomie juha piletina"). Koristi se SAMO u
// generičkom (fallback) uparivanju - sastojci s ručnim pravilima
// (config/ingredient-rules.ts) imaju vlastiti include/exclude. Popis je
// namjerno grub i konzervativan: bolje odbaciti graničnog kandidata nego
// dopustiti da prerađevina iskrivi cijenu sirovine.
const PROCESSED_PRODUCT_WORDS =
  /(?:^| )(okus|okusom|snack|krekeri|cips|chips|kasica|kasic|kasa|torta|kolac|sendvic|juha|juhe|mix|bruschette|vrhnje|sok|nektar|jogurt|noodle|noodles|keks|namaz|pasteta|salata|burek|pizza|sladoled|panirana|panirani|pohana|pohani|hrskava|hrskavi|smokice|umak|cokolada|bombon|pire|bebe|baby|kids|burger|narezak|kobasica|hrenovke)(?= |$)/g;

// Sastojak mora biti jedna od prve 4 riječi naziva ("Luk crveni 1kg",
// "Mljeveni crni papar", "Extra djevičansko maslinovo ulje"); kasnije
// pojavljivanje gotovo uvijek znači opis okusa ili sastava.
const PRIMARY_WORD_WINDOW = 4;

function isPrimaryMatch(normalizedName: string, queryWords: string[], headWord: string): boolean {
  // Riječ s popisa prerađevina ne smije odbaciti proizvod kad je ona sama
  // traženi sastojak ("kiselo vrhnje", "grčki jogurt", "zelena salata").
  for (const m of normalizedName.matchAll(PROCESSED_PRODUCT_WORDS)) {
    if (!queryWords.includes(m[1])) return false;
  }
  const leading = normalizedName.split(/\s+/).slice(0, PRIMARY_WORD_WINDOW).join(" ");
  return wordScore(headWord, leading) > 0;
}

/**
 * Kandidati za generičko (bez ručnog pravila) cijenjenje: isto što i
 * `matchProductCandidates`, ali samo primarni proizvodi - ne prerađevine u
 * kojima se sastojak tek spominje. Cijena iz ovakvog uparivanja u UI-u nosi
 * oznaku "procjena".
 */
export function matchPrimaryCandidates(index: ProductIndex, ingredientName: string): MatchCandidate[] {
  const queryWords = queryWordsOf(ingredientName);
  if (queryWords.length === 0) return [];
  const headWord = queryWords[queryWords.length - 1];
  return matchProductCandidates(index, ingredientName).filter((c) => isPrimaryMatch(c.normalizedName, queryWords, headWord));
}

/**
 * Zadržan stari potpis (jedan proizvod ili null) radi kompatibilnosti s
 * eventualnim jednostavnim pozivima izvan košarice - u samoj košarici se
 * više ne koristi, ondje ide `matchProductCandidates` kroz `pricing.ts`.
 */
export function matchProduct(index: ProductIndex, ingredientName: string): ProductForMatching | null {
  return matchProductCandidates(index, ingredientName)[0]?.product ?? null;
}
