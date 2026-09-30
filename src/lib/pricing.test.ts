import { describe, it, expect } from "vitest";
import {
  splitCompoundIngredientName,
  priceIngredientPart,
  priceShoppingItem,
  type PricingRule,
} from "@/lib/pricing";
import { buildProductIndex } from "@/lib/matching";
import { testProduct } from "@/lib/test-helpers";

function rule(overrides: Partial<PricingRule> & Pick<PricingRule, "include">): PricingRule {
  return { key: "test", label: "test", aliases: [], mode: "cheapest", looseOk: false, ...overrides };
}

let nextId = 0;
function product(name: string, price: number, netQuantity: number | null, extra: Partial<Parameters<typeof testProduct>[0]> = {}) {
  return testProduct({ id: String(nextId++), name, price, net_quantity: netQuantity, ...extra });
}

describe("priceIngredientPart - cijela pakiranja, nikad proporcija ili prosjek", () => {
  const pepperRule = rule({ include: /papar/ });
  const pepper = buildProductIndex([
    product("Crni papar u zrnu", 0.37, 0.014),
    product("Mljeveni crni papar", 1.29, 0.05),
    product("Mljeveni crni papar", 1.39, 0.1),
  ]);

  it("25 g papra -> jedno stvarno pakiranje od 50 g, ne 2x14 g niti proporcija", () => {
    const r = priceIngredientPart(pepper, "papar", 25, "g", pepperRule);
    expect(r.itemPrice).toBe(1.29);
    expect(r.purchase).toMatchObject({ packCount: 1, packSize: 0.05, soldByWeight: false });
    expect(r.purchase?.surplus).toBeCloseTo(0.025);
  });

  it("10 g papra -> najmanje pakiranje koje pokriva (14 g), višak je gubitak", () => {
    const r = priceIngredientPart(pepper, "papar", 10, "g", pepperRule);
    expect(r.itemPrice).toBe(0.37);
    expect(r.purchase?.packSize).toBe(0.014);
  });

  it("cijena je uvijek cijeli broj stvarnih pakiranja koja pokrivaju potrebu", () => {
    const packPrice: Record<number, number> = { 0.014: 0.37, 0.05: 1.29, 0.1: 1.39 };
    for (const grams of [1, 5, 14, 15, 30, 50, 60, 99, 100, 101, 250]) {
      const r = priceIngredientPart(pepper, "papar", grams, "g", pepperRule);
      const { packCount, packSize, purchaseQuantity } = r.purchase!;
      expect(Number.isInteger(packCount)).toBe(true);
      expect(purchaseQuantity).toBeGreaterThanOrEqual(grams / 1000 - 1e-9);
      expect(r.itemPrice).toBe(Math.round(packCount! * packPrice[packSize!] * 100) / 100);
    }
  });

  it("među pakiranjima iste veličine bira najjeftinije", () => {
    const index = buildProductIndex([
      product("Papar crni Brand A 20 g", 1.09, 0.02),
      product("KLC.Papar crni mljeveni 20g", 0.46, 0.02),
      product("Papar crni Brand B 50 g", 0.3, 0.05), // veće pakiranje, jeftinije, ali se ne bira
    ]);
    const r = priceIngredientPart(index, "papar", 15, "g", pepperRule);
    expect(r.itemPrice).toBe(0.46);
  });

  it("veća potreba od najvećeg pakiranja -> N istih pakiranja", () => {
    const index = buildProductIndex([product("Brašno glatko 1kg", 1.29, 1)]);
    const r = priceIngredientPart(index, "brašno", 2.5, "kg", rule({ include: /brasno/ }));
    expect(r.purchase).toMatchObject({ packCount: 3, packSize: 1 });
    expect(r.purchase?.surplus).toBeCloseTo(0.5);
    expect(r.itemPrice).toBe(3.87);
  });

  it("jedno veće pakiranje ima prednost pred više manjih", () => {
    const index = buildProductIndex([product("Riža 400 g", 0.99, 0.4), product("Riža 1kg", 1.59, 1)]);
    const r = priceIngredientPart(index, "riža", 550, "g", rule({ include: /riza/ }));
    expect(r.purchase).toMatchObject({ packCount: 1, packSize: 1 });
    expect(r.itemPrice).toBe(1.59);
  });

  it("volumen se čita iz naziva, ne iz mase (net_quantity ulja 500 ml je 0,458 kg)", () => {
    const index = buildProductIndex([product("Maslinovo ulje 500 ml", 4.49, 0.458)]);
    const r = priceIngredientPart(index, "maslinovo ulje", 40, "ml", rule({ include: /ulje/ }));
    expect(r.purchase).toMatchObject({ basis: "l", packCount: 1, packSize: 0.5 });
  });

  it("komadi se čitaju iz naziva (jaja 10/1), ne iz mase", () => {
    const index = buildProductIndex([product("Jaja 6/1", 1.5, 0.39), product("Jaja 10/1", 2.1, 0.65)]);
    const r = priceIngredientPart(index, "jaja", 8, "kom", rule({ include: /jaja/ }));
    expect(r.purchase).toMatchObject({ packCount: 1, packSize: 10 });
  });
});

describe("priceIngredientPart - nepouzdani podaci ne postaju izmišljena cijena", () => {
  it("nema kandidata -> cijena nedostupna, ne 0", () => {
    const r = priceIngredientPart(buildProductIndex([]), "nepostojeca namirnica", 1, "kom");
    expect(r.itemPrice).toBeNull();
    expect(r.purchase).toBeNull();
  });

  it("proizvod bez veličine pakiranja se preskače", () => {
    const index = buildProductIndex([product("Papar mljeveni", 1.29, null)]);
    expect(priceIngredientPart(index, "papar", 5, "g", rule({ include: /papar/ })).itemPrice).toBeNull();
  });

  it("nejasni 'net_quantity = 1' bez veličine u nazivu nije pakiranje od 1 kg (Vegeta bez looseOk)", () => {
    const index = buildProductIndex([product("Vegeta Univerzalni začin", 5.79, 1)]);
    expect(priceIngredientPart(index, "vegeta", 15, "g", rule({ include: /vegeta/ })).itemPrice).toBeNull();
  });

  it("nepodržana mjerna jedinica -> nedostupno", () => {
    const index = buildProductIndex([product("Papar 50 g", 1.29, 0.05)]);
    expect(priceIngredientPart(index, "papar", 1, "žlica", rule({ include: /papar/ })).itemPrice).toBeNull();
  });

  it("isključuje proizvode izvan hrane/pića čak i kad pravilo pogađa naziv", () => {
    const index = buildProductIndex([product("Sol za perilicu 2kg", 1.45, 2, { category: "Sredstva za čišćenje" })]);
    expect(priceIngredientPart(index, "sol", 10, "g", rule({ include: /sol/ })).itemPrice).toBeNull();
  });

  it("exclude iz pravila izbacuje varijante (aromatizirana sol, BIO)", () => {
    const index = buildProductIndex([
      product("Sol s češnjakom 30g", 0.4, 0.03),
      product("Kuhinjska jodirana sol 500 g", 0.35, 0.5),
    ]);
    const r = priceIngredientPart(index, "sol", 10, "g", rule({ include: /\bsol\b/, exclude: /cesnjak/ }));
    expect(r.itemPrice).toBe(0.35);
  });
});

describe("priceIngredientPart - na vagu (rinfuza)", () => {
  const looseRule = rule({ include: /luk/, looseOk: true });

  it("looseOk: rinfuza se računa proporcionalno po kg", () => {
    const index = buildProductIndex([product("Luk crveni rinfuza", 0.79, 1), product("Luk 750g", 1.19, 0.75)]);
    const r = priceIngredientPart(index, "luk", 100, "g", looseRule);
    expect(r.itemPrice).toBe(0.08);
    expect(r.purchase).toMatchObject({ soldByWeight: true, pricePerKg: 0.79, packCount: null, surplus: 0 });
  });

  it("looseOk: artikl bez veličine u nazivu (Kaufland 'Mrkva_OC') je na vagu", () => {
    const index = buildProductIndex([product("Mrkva_OC", 0.89, 1)]);
    const r = priceIngredientPart(index, "mrkva", 200, "g", rule({ include: /mrkva/, looseOk: true }));
    expect(r.itemPrice).toBe(0.18);
  });

  it("pravo pakiranje od 1 kg s veličinom u nazivu NIJE na vagu ni uz looseOk", () => {
    const index = buildProductIndex([product("Mrkva 1kg", 1.29, 1)]);
    const r = priceIngredientPart(index, "mrkva", 200, "g", rule({ include: /mrkva/, looseOk: true }));
    expect(r.purchase).toMatchObject({ soldByWeight: false, packCount: 1, packSize: 1 });
    expect(r.itemPrice).toBe(1.29);
  });

  it("'cca' u nazivu znači cijena po kg (svježa prsa 'cca 500g' 5,99 = 5,99 €/kg)", () => {
    const index = buildProductIndex([product("Svježa pileća prsa, bk sk, cca 500g", 5.99, 1)]);
    const r = priceIngredientPart(index, "pileća prsa", 500, "g", rule({ include: /prsa/ }));
    expect(r.purchase?.soldByWeight).toBe(true);
    expect(r.itemPrice).toBe(3);
  });

  it("mode 'cheapest' bira najjeftiniji €/kg, 'average' prosjek varijanti", () => {
    const index = buildProductIndex([
      product("Svježi pileći file, cca. 1kg", 4.99, 1),
      product("Svježa pileća prsa cca 500g", 5.99, 1),
      product("Svježi pileći filet cca 600g", 7.39, 1),
    ]);
    const cheapest = priceIngredientPart(index, "pileća prsa", 1, "kg", rule({ include: /pilec/, mode: "cheapest" }));
    expect(cheapest.itemPrice).toBe(4.99);
    expect(cheapest.averagedCount).toBe(1);
    expect(cheapest.matchedName).toBe("Svježi pileći file, cca. 1kg");

    const average = priceIngredientPart(index, "pileća prsa", 1, "kg", rule({ include: /pilec/, mode: "average" }));
    expect(average.itemPrice).toBe(6.12); // (4.99 + 5.99 + 7.39) / 3
    expect(average.averagedCount).toBe(3);
    expect(average.matchedName).toBeNull();
  });

  it("prosjek se ne primjenjuje na pakirane proizvode - uvijek najjeftinije", () => {
    const index = buildProductIndex([product("Riža A 1kg", 1.59, 1), product("Riža B 1kg", 5.99, 1)]);
    const r = priceIngredientPart(index, "riža", 300, "g", rule({ include: /riza/, mode: "average" }));
    expect(r.itemPrice).toBe(1.59);
  });
});

describe("priceIngredientPart - generičko uparivanje (bez pravila) je označeno kao procjena", () => {
  it("ne miješa prerađevine u cijenu sirovine (luk vs. krekeri s okusom luka)", () => {
    const index = buildProductIndex([
      product("Luk crveni 1kg", 0.79, 1),
      product("Tuc krekeri vrhnje luk 100 g", 0.75, 0.1),
      product("BO Pontino špek-luk-sir", 1.39, 0.125),
    ]);
    const r = priceIngredientPart(index, "luk", 500, "g");
    expect(r.estimated).toBe(true);
    expect(r.matchedName).toBe("Luk crveni 1kg");
    expect(r.itemPrice).toBe(0.79);
  });

  it("sastojak s pravilom nije procjena", () => {
    const index = buildProductIndex([product("Luk crveni 1kg", 0.79, 1)]);
    expect(priceIngredientPart(index, "luk", 500, "g", rule({ include: /luk/ })).estimated).toBe(false);
  });
});

describe("splitCompoundIngredientName - audit N5 (\"mrkva i celer\")", () => {
  it("razdvaja 'i' spojeve", () => {
    expect(splitCompoundIngredientName("mrkva i celer")).toEqual({ parts: ["mrkva", "celer"], mode: "and" });
  });

  it("razdvaja 'ili' spojeve", () => {
    expect(splitCompoundIngredientName("kiselo vrhnje ili grčki jogurt")).toEqual({
      parts: ["kiselo vrhnje", "grčki jogurt"],
      mode: "or",
    });
  });

  it("ostavlja obične sastojke netaknutima", () => {
    expect(splitCompoundIngredientName("mlijeko")).toEqual({ parts: ["mlijeko"], mode: "single" });
  });
});

describe("priceShoppingItem - složeni sastojci se više ne gube (audit N5)", () => {
  it("cijeni OBA dijela 'mrkva i celer' i zbraja ih", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Mrkva 1kg", price: 0.99, net_quantity: 1 }),
      testProduct({ id: "2", name: "Celer korijen 500g", price: 1.2, net_quantity: 0.5 }),
    ]);
    const result = priceShoppingItem(index, { name: "mrkva i celer", quantity: 0.3, unit: "kg" });
    expect(result.mode).toBe("and");
    expect(result.parts).toHaveLength(2);
    expect(result.parts.every((p) => p.itemPrice !== null)).toBe(true);
    expect(result.totalPrice).not.toBeNull();
  });

  it("za 'ili' spojeve bira jeftiniju cijenjenu alternativu", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Kiselo vrhnje 200ml", price: 1.0, net_quantity: 0.2 }),
      testProduct({ id: "2", name: "Grčki jogurt 200g", price: 0.6, net_quantity: 0.2 }),
    ]);
    const result = priceShoppingItem(index, { name: "kiselo vrhnje ili grčki jogurt", quantity: 0.2, unit: "kg" });
    expect(result.mode).toBe("or");
    expect(result.chosenPartIndex).toBe(1); // grčki jogurt je jeftiniji
  });
});
