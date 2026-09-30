import { normalize, splitFrozenRequest } from "@/lib/normalize";
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
// Što svježe povrće NIJE: konzerve, kiseljenje, prerađevine, BIO (izbačen
// osim ako ga recept izričito traži - vidi odluku u PROJECT_STATUS.md).
const NOT_FRESH =
  "bio|kbio|konzerv|sterilizir|rasol|staklen|om \\d|kisel|ukis|u octu|juha|krem|umak|pire|pasta|ajvar|susen|prah|cips|chips|snack|pizza|kolac|kasica|bebe|salata od|mljev|zacin|caj|sirup|kandir|marin|pecen|grill|prz|punjen|namaz";

/**
 * Svježe povrće: u Kauflandu (i dijelom Lidlu) prodaje se na vagu, pa je
 * `looseOk`; bira se najjeftiniji proizvod; smrznuto samo ako svježeg nema
 * ili ga recept traži (`fresh`). `extraExclude` dodaje izuzetke po sastojku.
 */
function freshVegetable(rule: {
  key: string;
  label: string;
  aliases: string[];
  include: RegExp;
  extraExclude?: string;
}): PricingRule {
  return {
    key: rule.key,
    label: rule.label,
    aliases: rule.aliases,
    include: rule.include,
    exclude: new RegExp(`\\b(${NOT_FRESH}${rule.extraExclude ? `|${rule.extraExclude}` : ""})`),
    mode: "cheapest",
    looseOk: true,
    fresh: true,
  };
}

export const INGREDIENT_RULES: PricingRule[] = [

  // --- svježe povrće -------------------------------------------------------
  freshVegetable({ key: "cvjetaca", label: "Cvjetača", aliases: ["cvjetaca", "karfiol"], include: /(^| )(cvjetaca|karfiol)( |$)/, extraExclude: "pan|pohan" }),
  freshVegetable({ key: "luk", label: "Luk", aliases: ["luk", "crveni luk", "luk crveni"], include: /^(klc |kbio )?luk( |$)/, extraExclude: "mlad|kruton|kolutic|krekeri|vezica|srebrenac|ljutika|shallot|rukavac" }),
  freshVegetable({ key: "mrkva", label: "Mrkva", aliases: ["mrkva"], include: /^(klc |kbio )?mrkva( |$)/, extraExclude: "julienne|baby|kas|mlada|zuta|torta|rezan|ribana|kuhana" }),
  freshVegetable({ key: "persin", label: "Peršin", aliases: ["persin", "persina"], include: /^(klc )?persin( |$)/, extraExclude: "sjemen|sol" }),
  freshVegetable({ key: "sampinjoni", label: "Šampinjoni", aliases: ["sampinjoni", "sampinjon"], include: /(^| )sampinjon/, extraExclude: "salata|3 klasa|freshona|mix|portabella|baguette|ragu|tartuf|podravka" }),
  freshVegetable({ key: "krumpir", label: "Krumpir", aliases: ["krumpir", "krumpiri"], include: /^(klc |kbio )?krumpir( |$)/, extraExclude: "batat|salata|stapic|mrezast|pekarsk|krumpirici|pire|slatk" }),
  freshVegetable({ key: "batat", label: "Batat", aliases: ["batat", "slatki krumpir"], include: /(^| )batat( |$)/ }),
  freshVegetable({ key: "celer", label: "Celer", aliases: ["celer", "celer korijen"], include: /^(klc )?celer( |$)/, extraExclude: "salata" }),
  freshVegetable({ key: "cikla", label: "Cikla", aliases: ["cikla", "repa cikla"], include: /(^| )cikla( |$)/, extraExclude: "kuhana|kockica|kriska|multipack" }),
  freshVegetable({ key: "kelj", label: "Kelj", aliases: ["kelj"], include: /^kelj( |$)/, extraExclude: "pupcar" }),
  freshVegetable({ key: "kupus", label: "Kupus", aliases: ["kupus", "bijeli kupus", "kupus bijeli"], include: /^(klc )?kupus( bijeli)?( |$)/, extraExclude: "crven|kineski|salata|slatk|rezan|glavica" }),
  freshVegetable({ key: "crveni-kupus", label: "Crveni kupus", aliases: ["crveni kupus", "kupus crveni"], include: /kupus crveni|crveni kupus/, extraExclude: "salata|slatk|rezan|glavica" }),
  freshVegetable({ key: "brokula", label: "Brokula", aliases: ["brokula", "brokoli"], include: /(^| )(brokula|brokoli)( |$)/, extraExclude: "brokulini" }),
  freshVegetable({ key: "tikvica", label: "Tikvica", aliases: ["tikvica", "tikvice"], include: /(^| )tikvic/, extraExclude: "salata" }),
  freshVegetable({ key: "patlidzan", label: "Patlidžan", aliases: ["patlidzan", "patlidzani"], include: /(^| )patlidzan/ }),
  freshVegetable({ key: "paprika", label: "Paprika", aliases: ["paprika", "paprike"], include: /^(klc )?paprika( |$)/, extraExclude: "ljut|slatk|sal|mix|rotunda|mini|salam" }),
  freshVegetable({ key: "ljuta-paprika", label: "Ljuta paprika", aliases: ["ljuta paprika", "paprika ljuta", "chili", "čili"], include: /paprika ljut|ljut.*paprika|^(klc )?chili( |$)/, extraExclude: "mix|sal" }),
  freshVegetable({ key: "rajcica", label: "Rajčica", aliases: ["rajcica", "rajcice", "paradajz"], include: /^(klc )?rajcica( |$)/, extraExclude: "pasirana|sok|pelat|juice|kecap|koncentr|ulju|konz|salata|mini|cherry|koktel|snack" }),
  freshVegetable({ key: "krastavac", label: "Krastavac", aliases: ["krastavac", "krastavci"], include: /(^| )krastav/, extraExclude: "kornis|kiselj|mini|snack|salata|slatko" }),
  freshVegetable({ key: "poriluk", label: "Poriluk", aliases: ["poriluk"], include: /(^| )poriluk/ }),
  freshVegetable({ key: "radic", label: "Radič", aliases: ["radic", "radić"], include: /(^| )radic/ }),
  freshVegetable({ key: "dumbir", label: "Đumbir", aliases: ["dumbir", "đumbir"], include: /^(klc )?dumbir/, extraExclude: "sok|kis|sushi" }),
  freshVegetable({ key: "cesnjak", label: "Češnjak", aliases: ["cesnjak", "bijeli luk", "cesnjak domaci"], include: /^(klc )?cesnjak/, extraExclude: "granul|u prahu|sjecka|bocic|pasta|ulje" }),
  freshVegetable({ key: "spinat", label: "Špinat", aliases: ["spinat"], include: /^(klc )?spinat/, extraExclude: "jastucic|pita|sir" }),
  freshVegetable({ key: "mahune", label: "Mahune", aliases: ["mahune", "zelene mahune"], include: /^(klc )?(zelene |zute |mlade )?mahun/, extraExclude: "xxl|salata|mahunark|edamame" }),
  freshVegetable({ key: "salata", label: "Zelena salata", aliases: ["zelena salata", "salata"], include: /^salata (iceberg|hrastov|kristal|puterica|regica|srcika|s korijenom|zelena|glavata|rukola)|^zelena salata/ }),
  freshVegetable({ key: "grasak", label: "Grašak", aliases: ["grasak"], include: /(^| )grasak( |$)/, extraExclude: "tuna|mrkv|mjesav|wasabi|riza|piletin|tjest|salat" }),
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
    key: "maslinovo-ulje",
    label: "Maslinovo ulje",
    aliases: ["maslinovo ulje", "ulje maslinovo"],
    include: /maslinov.*ulje|ulje.*maslinov/,
    exclude: /\b(sprej|spray|bio|kbio|tartuf|limun|cesnj|aroma|nadjev|masline|pest|ocat|salat|okus|za )/,
    mode: "cheapest",
    looseOk: false,
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
    // Batak je zasebni sastojak (zabatak, pureći i "batak + zabatak" ne ulaze).
    // Svježi batak se prodaje na vagu; kao i prsa, cijena je prosjek varijanti.
    key: "pileci-batak",
    label: "Pileći batak",
    aliases: ["pileci batak", "batak"],
    include: /(^| )batak( |$)/,
    exclude:
      /\b(zabat|pureci|otkost|panir|pohan|smrz|dimlj|marin|kids|ovitk|mini|kebab|bio|pecen|zacin)|( i zab)|( sa zab)/,
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

const FROZEN_VARIANTS = new Map<string, PricingRule>();

/**
 * Pravilo za sastojak iz recepta (po normaliziranom nazivu/sinonimu) ili
 * undefined -> generičko uparivanje. Recept koji izričito traži smrznuto
 * ("smrznuti grašak") dobiva zasebnu varijantu pravila, pa se ne spaja sa
 * svježim istog sastojka.
 */
export function findIngredientRule(ingredientName: string): PricingRule | undefined {
  const { cleaned, frozen } = splitFrozenRequest(ingredientName);
  const rule = RULE_BY_ALIAS.get(normalizeIngredientName(cleaned));
  if (!rule || !frozen) return rule;
  let variant = FROZEN_VARIANTS.get(rule.key);
  if (!variant) {
    variant = { ...rule, key: `${rule.key}-frozen`, label: `${rule.label} smrznuto`, requireFrozen: true };
    FROZEN_VARIANTS.set(rule.key, variant);
  }
  return variant;
}
