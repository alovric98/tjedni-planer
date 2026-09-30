import { describe, it, expect } from "vitest";
import lidlCatalog from "@/lib/__fixtures__/catalog-lidl.json";
import kauflandCatalog from "@/lib/__fixtures__/catalog-kaufland.json";
import { buildProductIndex } from "@/lib/matching";
import { mergeItemsByRule, priceShoppingItem, type BasketLineResult } from "@/lib/pricing";
import type { ProductForMatching } from "@/lib/products";
import { findIngredientRule } from "@/config/ingredient-rules";

// Stvarni retci iz recepata (query na recipe_ingredients, 30.9.2026).
const RECIPE_ROWS = [
  { name: "Biber", unit: "g", quantity: 10 },
  { name: "Cvjetača", unit: "g", quantity: 250 },
  { name: "Grašak", unit: "g", quantity: 200 },
  { name: "Luk", unit: "g", quantity: 100 },
  { name: "Maslinovo ulje", unit: "ml", quantity: 40 },
  { name: "Mrkva", unit: "g", quantity: 200 },
  { name: "Papar", unit: "g", quantity: 5 },
  { name: "Peršin", unit: "g", quantity: 150 },
  { name: "Pileća prsa", unit: "g", quantity: 500 },
  { name: "Piletina", unit: "g", quantity: 500 },
  { name: "Riza", unit: "g", quantity: 250 },
  { name: "Riža", unit: "g", quantity: 300 },
  { name: "Sampinjoni", unit: "g", quantity: 200 },
  { name: "Sol", unit: "g", quantity: 10 },
  { name: "Vegeta", unit: "g", quantity: 15 },
];

function toProducts(catalog: { products: Omit<ProductForMatching, "id">[] }): ProductForMatching[] {
  return catalog.products.map((p, i) => ({ ...p, id: String(i) }));
}

function basket(catalog: { products: Omit<ProductForMatching, "id">[] }): Map<string, BasketLineResult> {
  const index = buildProductIndex(toProducts(catalog));
  const rows = mergeItemsByRule(RECIPE_ROWS, findIngredientRule).map((item) =>
    priceShoppingItem(index, item, findIngredientRule)
  );
  return new Map(rows.map((r) => [r.ingredient, r]));
}

// Očekivane cijene su provjerene ručno nad stvarnim katalogom (30.9.2026),
// po pravilu: najmanje pakiranje koje pokriva potrebu, najjeftinije unutar
// 2x te veličine; na vagu samo gdje pravilo dopušta; prosjek samo za prsa.
const EXPECTED: Record<"lidl" | "kaufland", Record<string, number>> = {
  lidl: {
    Papar: 1.29, // Mljeveni crni papar 50 g (prije 0,44 € za "0,03 kg")
    Cvjetača: 1.99,
    Grašak: 1.19, // nema svježeg -> smrznuto (Freshona 450 g); konzerva se ne koristi
    Luk: 0.08, // rinfuza 0,79 €/kg x 100 g (prije prosjek 19 proizvoda)
    "Maslinovo ulje": 4.49,
    Mrkva: 1.29, // Mrkva 1 kg (prije 1,42 € iz prosjeka s tortom i kolačem)
    Peršin: 1.29,
    "Pileća prsa": 6.52, // prosjek 6 varijanti svježih prsa/filea, 1 kg (Piletina + Pileća prsa spojeno)
    Riža: 1.59, // Riža + Riza spojeno: 550 g -> 1 kg
    Sampinjoni: 1.29, // naziv kako piše u receptu (bez dijakritika)
    Sol: 0.35,
    Vegeta: 1.19, // stvarno pakiranje od 75 g (prije 0,57 € proporcionalno)
  },
  kaufland: {
    Papar: 0.46, // KLC Papar crni mljeveni 20 g (Papar + Biber = 15 g)
    Cvjetača: 0.5,
    Grašak: 0.6, // KLC zeleni grašak 500 g (konzerva Bonduelle izbačena)
    Luk: 0.07,
    "Maslinovo ulje": 4.49,
    Mrkva: 0.18,
    Peršin: 2.49,
    "Pileća prsa": 6.59,
    Riža: 1.59,
    Sampinjoni: 0.7,
    Sol: 0.49,
    Vegeta: 1.09,
  },
};

describe.each([
  ["lidl", lidlCatalog],
  ["kaufland", kauflandCatalog],
] as const)("golden košarica - %s (stvarni katalog 30.9.2026)", (store, catalog) => {
  const rows = basket(catalog);

  it("sinonimi iz recepata su spojeni u jedan redak po sastojku", () => {
    expect([...rows.keys()].sort()).toEqual(Object.keys(EXPECTED[store]).sort());
  });

  it.each(Object.entries(EXPECTED[store]))("%s -> %s €", (ingredient, price) => {
    expect(rows.get(ingredient)?.totalPrice).toBe(price);
  });

  it("nijedan sastojak nije generička procjena ni nedostupan", () => {
    for (const row of rows.values()) {
      expect(row.totalPrice, row.ingredient).not.toBeNull();
      expect(row.parts[0].estimated, row.ingredient).toBe(false);
    }
  });

  it("cijela pakiranja: kupljena količina pokriva potrebu, broj pakiranja je cijeli, vaga samo uz pravilo", () => {
    for (const row of rows.values()) {
      const { purchase } = row.parts[0];
      expect(purchase, row.ingredient).not.toBeNull();
      expect(purchase!.purchaseQuantity, row.ingredient).toBeGreaterThanOrEqual(purchase!.neededQuantity - 1e-9);
      if (purchase!.soldByWeight) {
        expect(findIngredientRule(row.ingredient)?.looseOk, row.ingredient).toBe(true);
      } else {
        expect(Number.isInteger(purchase!.packCount), row.ingredient).toBe(true);
        expect(purchase!.surplus, row.ingredient).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });
});

// Ostalo svježe povrće + batak: količine su UZORAK (nisu iz trenutnih recepata),
// cijene su provjerene ručno nad stvarnim katalogom 30.9.2026. `null` = trgovina
// nema odgovarajući proizvod (Lidl ima samo BIO đumbir, a BIO je izbačen).
const EXTRA_ROWS = [
  { name: "Pileći batak", unit: "g", quantity: 1000 },
  { name: "Krumpir", unit: "g", quantity: 1000 },
  { name: "Batat", unit: "g", quantity: 400 },
  { name: "Celer", unit: "g", quantity: 150 },
  { name: "Cikla", unit: "g", quantity: 300 },
  { name: "Kelj", unit: "g", quantity: 400 },
  { name: "Kupus", unit: "g", quantity: 500 },
  { name: "Crveni kupus", unit: "g", quantity: 500 },
  { name: "Brokula", unit: "g", quantity: 300 },
  { name: "Tikvice", unit: "g", quantity: 500 },
  { name: "Patlidžan", unit: "g", quantity: 300 },
  { name: "Paprika", unit: "g", quantity: 300 },
  { name: "Ljuta paprika", unit: "g", quantity: 30 },
  { name: "Rajčica", unit: "g", quantity: 400 },
  { name: "Krastavac", unit: "g", quantity: 200 },
  { name: "Poriluk", unit: "g", quantity: 100 },
  { name: "Radič", unit: "g", quantity: 100 },
  { name: "Đumbir", unit: "g", quantity: 20 },
  { name: "Bijeli luk", unit: "g", quantity: 10 },
  { name: "Špinat", unit: "g", quantity: 300 },
  { name: "Mahune", unit: "g", quantity: 300 },
  { name: "Zelena salata", unit: "g", quantity: 150 },
  { name: "Smrznuti grašak", unit: "g", quantity: 200 },
];

const EXPECTED_EXTRA: Record<"lidl" | "kaufland", Record<string, number | null>> = {
  lidl: {
    "Pileći batak": 4.09, "Krumpir": 0.89, "Batat": 0.8, "Celer": 0.15, "Cikla": 0.24, "Kelj": 0.6,
    "Kupus": 0.4, "Crveni kupus": 0.4, "Brokula": 1.99, "Tikvice": 0.85, "Patlidžan": 0.39, "Paprika": 0.69,
    "Ljuta paprika": 0.12, "Rajčica": 0.8, "Krastavac": 0.34, "Poriluk": 1.49, "Radič": 0.3, "Đumbir": null,
    "Bijeli luk": 1.39, "Špinat": 1.15, "Mahune": 2.25, "Zelena salata": 0.89, "Smrznuti grašak": 1.19,
  },
  kaufland: {
    "Pileći batak": 3.97, "Krumpir": 0.99, "Batat": 0.8, "Celer": 0.15, "Cikla": 0.24, "Kelj": 0.6,
    "Kupus": 0.4, "Crveni kupus": 0.4, "Brokula": 1.59, "Tikvice": 0.85, "Patlidžan": 0.39, "Paprika": 0.6,
    "Ljuta paprika": 0.12, "Rajčica": 1.08, "Krastavac": 0.34, "Poriluk": 0.2, "Radič": 0.4, "Đumbir": 0.09,
    "Bijeli luk": 1.59, "Špinat": 0.89, "Mahune": 1.49, "Zelena salata": 0.59, "Smrznuti grašak": 1.39,
  },
};

describe.each([
  ["lidl", lidlCatalog],
  ["kaufland", kauflandCatalog],
] as const)("golden - ostalo svježe povrće i batak - %s", (store, catalog) => {
  const index = buildProductIndex(toProducts(catalog));
  const rows = new Map(
    mergeItemsByRule(EXTRA_ROWS, findIngredientRule).map((item) => {
      const r = priceShoppingItem(index, item, findIngredientRule);
      return [r.ingredient, r] as const;
    })
  );

  it.each(Object.entries(EXPECTED_EXTRA[store]))("%s -> %s €", (ingredient, price) => {
    expect(rows.get(ingredient)?.totalPrice ?? null).toBe(price);
  });

  it("nijedan od ovih sastojaka nije generička procjena", () => {
    for (const row of rows.values()) expect(row.parts[0].estimated, row.ingredient).toBe(false);
  });

  it("smrznuto se nikad ne računa na vagu", () => {
    for (const row of rows.values()) {
      const part = row.parts[0];
      if (part.frozen) expect(part.purchase?.soldByWeight, row.ingredient).toBe(false);
    }
  });
});

describe("svježe ima prednost, smrznuto samo kad svježeg nema ili ga recept traži", () => {
  it("Lidl špinat nema svježeg -> smrznuti, označen kao smrznuto", () => {
    const index = buildProductIndex(toProducts(lidlCatalog));
    const part = priceShoppingItem(index, { name: "Špinat", quantity: 300, unit: "g" }, findIngredientRule).parts[0];
    expect(part.frozen).toBe(true);
  });

  it("Kaufland cvjetača je svježa (na vagu), ne smrznuta", () => {
    const index = buildProductIndex(toProducts(kauflandCatalog));
    const part = priceShoppingItem(index, { name: "Cvjetača", quantity: 250, unit: "g" }, findIngredientRule).parts[0];
    expect(part.frozen).toBe(false);
    expect(part.purchase?.soldByWeight).toBe(true);
  });

  it("Lidl cvjetača ima smrznutu i svježu varijantu - bira svježu (cijena po komadu, pakiranje ~914 g)", () => {
    const index = buildProductIndex(toProducts(lidlCatalog));
    const part = priceShoppingItem(index, { name: "Cvjetača", quantity: 250, unit: "g" }, findIngredientRule).parts[0];
    expect(part.frozen).toBe(false);
    expect(part.matchedName).toBe("Cvjetača");
    expect(part.itemPrice).toBe(1.99);
  });

  it("recept koji traži smrznuto dobiva samo smrznute proizvode", () => {
    const index = buildProductIndex(toProducts(lidlCatalog));
    const part = priceShoppingItem(index, { name: "Smrznuta cvjetača", quantity: 250, unit: "g" }, findIngredientRule).parts[0];
    expect(part.frozen).toBe(true);
    expect(part.matchedName).toContain("smrznuta");
  });

  it("smrznuto i svježe istog sastojka se ne spajaju u jedan redak", () => {
    const merged = mergeItemsByRule(
      [
        { name: "Grašak", unit: "g", quantity: 100 },
        { name: "Smrznuti grašak", unit: "g", quantity: 100 },
      ],
      findIngredientRule
    );
    expect(merged).toHaveLength(2);
  });
});

describe("primjeri s ekrana koji su bili pogrešni", () => {
  it("Papar 25 g (Lidl) je jedno pravo pakiranje od 50 g, ne 0,44 € za 0,03 kg", () => {
    const index = buildProductIndex(toProducts(lidlCatalog));
    const [row] = [priceShoppingItem(index, { name: "Papar", quantity: 25, unit: "g" }, findIngredientRule)];
    expect(row.totalPrice).toBe(1.29);
    expect(row.parts[0].purchase).toMatchObject({ packCount: 1, packSize: 0.05 });
  });

  it("Piletina 2,5 kg (Lidl) je oko 6,5 €/kg sirovih prsa, ne 26,55 €", () => {
    const index = buildProductIndex(toProducts(lidlCatalog));
    const row = priceShoppingItem(index, { name: "Piletina", quantity: 2.5, unit: "kg" }, findIngredientRule);
    expect(row.totalPrice).toBe(16.31);
    expect(row.parts[0].purchase?.pricePerKg).toBeCloseTo(6.52, 2);
  });
});

describe("findIngredientRule / mergeItemsByRule", () => {
  it("pronalazi pravilo po sinonimu, bez dijakritika i uz zagrade", () => {
    expect(findIngredientRule("Biber")?.key).toBe("papar");
    expect(findIngredientRule("Piletina")?.key).toBe("pileca-prsa");
    expect(findIngredientRule("Riza")?.key).toBe("riza");
    expect(findIngredientRule("Riža")?.key).toBe("riza");
    expect(findIngredientRule("Luk (crveni)")?.key).toBe("luk");
  });

  it("ne miješa srodne sastojke koji znače drugo (bijeli luk ≠ luk, batak ≠ zabatak)", () => {
    expect(findIngredientRule("bijeli luk")?.key).toBe("cesnjak"); // ne "luk"
    expect(findIngredientRule("luk")?.key).toBe("luk");
    expect(findIngredientRule("pileći batak")?.key).toBe("pileci-batak");
    expect(findIngredientRule("pileći zabatak")).toBeUndefined();
    expect(findIngredientRule("Persina")?.key).toBe("persin");
  });

  it("spaja sinonime i zbraja količine, i kad su jedinice različite (g + kg)", () => {
    const merged = mergeItemsByRule(
      [
        { name: "Papar", unit: "g", quantity: 5 },
        { name: "Biber", unit: "g", quantity: 10 },
        { name: "Piletina", unit: "kg", quantity: 0.5 },
        { name: "Pileća prsa", unit: "g", quantity: 250 },
        { name: "Tikvice", unit: "g", quantity: 300 },
      ],
      findIngredientRule
    );
    expect(merged).toEqual([
      { name: "Papar", unit: "g", quantity: 15 },
      { name: "Pileća prsa", unit: "g", quantity: 750 },
      { name: "Tikvice", unit: "g", quantity: 300 },
    ]);
  });

  it("jedan redak ostaje netaknut s izvornim nazivom", () => {
    const items = [{ name: "Piletina", unit: "g", quantity: 500 }];
    expect(mergeItemsByRule(items, findIngredientRule)).toEqual(items);
  });
});
