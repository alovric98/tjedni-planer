import { normalize } from "@/lib/normalize";
import type { PricingRule } from "@/lib/pricing";

/**
 * Ručno definirana pravila cijenjenja po sastojku. Cjenik Kaufland/Lidl ne
 * daje potkategoriju (samo HRANA/PIĆE), pa generičko uparivanje za začine,
 * sol, rižu i ulje bira egzotične varijante (zeleni papar 12 g, sol s
 * češnjakom, Vegeta Grill) - provjereno na stvarnom katalogu 30.9.2026.
 * Pravilo određuje REFERENTNI SKUP proizvoda za sastojak; unutar njega
 * `pricing.ts` bira pakiranje/cijenu.
 *
 * - `include` / `exclude`: regexi nad normaliziranim nazivom proizvoda
 *   (`normalizeProductName`: mala slova, bez dijakritika, interpunkcija -> razmak).
 * - `aliases`: nazivi sastojka iz recepata (normalizirani) koje pravilo pokriva;
 *   sinonimi koji su u receptima različiti redci ("Papar" + "Biber",
 *   "Piletina" + "Pileća prsa") spajaju se u jedan sastojak prije cijenjenja.
 * - BIO varijante su izbačene, osim ako ih recept izričito traži.
 *
 * Sastojak koji ovdje nema pravila i dalje se cijeni (generičko uparivanje),
 * ali je u košarici označen kao "procjena". Novo pravilo dodaj tek kad imaš
 * stvarni primjer iz recepta i provjeru nad katalogom (vidi
 * ingredient-rules.test.ts).
 */
export const INGREDIENT_RULES: PricingRule[] = [
  {
    key: "papar",
    label: "Papar",
    aliases: ["papar", "biber", "crni papar", "mljeveni papar"],
    include: /^(?=.*\bpapar\b)(?=.*\bcrn)(?=.*\bmljeven)/,
    exclude: /\b(sol|mjesav|slatk|kajen|chili|bijel|cvjet|limun|cesnj|snack|keks|cips|chips|okus|mlin|bio|premium)/,
    mode: "cheapest",
    looseOk: false,
  },
  {
    key: "cvjetaca",
    label: "Cvjetača",
    aliases: ["cvjetaca", "karfiol"],
    include: /(^| )(cvjetaca|karfiol)( |$)/,
    exclude: /\b(bio|kbio|smrzn|salata|juha|mix|krem|pan|pohan|umak)/,
    mode: "cheapest",
    looseOk: true,
  },
  {
    key: "grasak",
    label: "Grašak",
    aliases: ["grasak"],
    include: /(^| )grasak( |$)/,
    exclude: /\b(tuna|mrkv|bio|mjesav|juha|pire|wasabi|cips|snack|kasica|bebe|riza|piletin|tjest|salat)/,
    mode: "cheapest",
    looseOk: false,
  },
  {
    key: "luk",
    label: "Luk",
    aliases: ["luk", "crveni luk", "luk crveni"],
    include: /^(klc |kbio )?luk( |$)/,
    exclude: /\b(mlad|kruton|kolutic|prah|krekeri|snack|przen|bio|cesnj|vezica|srebrenac)/,
    mode: "cheapest",
    looseOk: true,
  },
  {
    key: "maslinovo-ulje",
    label: "Maslinovo ulje",
    aliases: ["maslinovo ulje", "ulje maslinovo"],
    include: /maslinov.*ulje|ulje.*maslinov/,
    exclude: /\b(sprej|spray|bio|kbio|tartuf|limun|cesnj|aroma|nadjev|masline|pest|ocat|salat|okus|za )/,
    mode: "cheapest",
    looseOk: false,
  },
  {
    key: "mrkva",
    label: "Mrkva",
    aliases: ["mrkva"],
    include: /^(klc |kbio )?mrkva( |$)/,
    exclude: /\b(bio|julienne|baby|kas|mlada|zuta|torta|kolac|sok|rezan|ribana|konz)/,
    mode: "cheapest",
    looseOk: true,
  },
  {
    key: "persin",
    label: "Peršin",
    aliases: ["persin"],
    include: /^(klc )?persin( |$)/,
    exclude: /\b(bio|sjemen|sol|zacin|susen)/,
    mode: "cheapest",
    looseOk: true,
  },
  {
    // "Piletina" u receptima = prsa. Svježa prsa se prodaju na vagu u više
    // varijanti (file, s kosti, s kožom), pa je cijena PROSJEK tih varijanti.
    // Batak/zabatak/cijela piletina su zasebni sastojci (nemaju pravilo).
    key: "pileca-prsa",
    label: "Pileća prsa",
    aliases: ["pileca prsa", "piletina", "pileci file", "pileca prsa bez kosti"],
    include: /pilec[aei]? (prsa|file|filet)|pileci file|pilece prsa/,
    exclude:
      /\b(ovitk|narez|dimlj|slim|panir|pohan|smrz|burger|xxl|kids|salat|sendvic|mljev|snack|flips|bacon|sir|kebab|gyros|steak|odrez|nuget|marin|medalj|pasteta|kobas|zabat|batak|krilc|leda|vrat|zelud|jetr|cijel|panad|stapic|mix|trakic|cornflak|jeli)/,
    mode: "average",
    looseOk: true,
  },
  {
    key: "riza",
    label: "Riža",
    aliases: ["riza"],
    include: /(^| )riza( |$)/,
    exclude:
      /\b(sushi|bio|rizin|napitak|biljn|snack|mlijek|sladoled|pudding|kolac|instant|integral|risotto|jasmin|thai|kuhan|salat|rizot|slatk|mix|povrc|basmati|arborio|divlj|crn|crven|cips|keks|torta|kasa|jabuk|cokol|konjak|ekstrud|kakao|gyros|bebivita|carnaroli|cjelovit|smed|vrste)/,
    mode: "cheapest",
    looseOk: false,
  },
  {
    key: "sampinjoni",
    label: "Šampinjoni",
    aliases: ["sampinjoni", "sampinjon"],
    include: /(^| )sampinjon/,
    exclude: /\b(bio|konz|salat|juha|umak|krem|marin|zamrz|smrz|pohan|pan|kisel|ulje|pasteta|pizza|klasa|freshona)/,
    mode: "cheapest",
    looseOk: true,
  },
  {
    // Samo obična kuhinjska sol (sitna/krupna/tuzlanska) - ne mlinac, dozator,
    // himalajska ni začinske mješavine; "najmanje pakiranje" bi inače pogodilo njih.
    key: "sol",
    label: "Sol",
    aliases: ["sol", "kuhinjska sol"],
    include: /^(?=.*(^| )sol( |$))(?=.*(kuhinjsk|sitn|krupn|tuzlansk))/,
    exclude: /\b(doz|mlin|himalaj|dimlj|cesnj|zacin|limun|chili|tartuf|bio|premium|kikiriki|kotanyi|vegeta|za )/,
    mode: "cheapest",
    looseOk: false,
  },
  {
    key: "vegeta",
    label: "Vegeta",
    aliases: ["vegeta"],
    include: /^vegeta( |$)/,
    exclude: /\b(maestro|natur|grill|pikant|mediteran|juha|pasta|bio|gourmet|kocka|fino|paprika|cesnj|piletin|riba|povrc|mix|za )/,
    mode: "cheapest",
    looseOk: false,
  },
];

function normalizeIngredientName(name: string): string {
  return normalize(name.replace(/\([^)]*\)/g, " ")).replace(/\s+/g, " ").trim();
}

const RULE_BY_ALIAS = new Map<string, PricingRule>();
for (const rule of INGREDIENT_RULES) {
  for (const alias of [...rule.aliases, normalizeIngredientName(rule.label)]) {
    RULE_BY_ALIAS.set(alias, rule);
  }
}

/** Pravilo za sastojak iz recepta (po normaliziranom nazivu/sinonimu) ili undefined -> generičko uparivanje. */
export function findIngredientRule(ingredientName: string): PricingRule | undefined {
  return RULE_BY_ALIAS.get(normalizeIngredientName(ingredientName));
}
