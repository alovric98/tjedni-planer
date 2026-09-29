import { describe, it, expect } from "vitest";
import {
  computeAveragePrice,
  calculatePurchaseQuantity,
  splitCompoundIngredientName,
  priceIngredientPart,
  priceShoppingItem,
} from "@/lib/pricing";
import { buildProductIndex } from "@/lib/matching";
import { testProduct } from "@/lib/test-helpers";

describe("computeAveragePrice - FIX 1 matematika prosjeka", () => {
  it("0 kandidata -> cijena nedostupna, ne 0", () => {
    const result = computeAveragePrice([]);
    expect(result.unitPrice).toBeNull();
    expect(result.usedAverage).toBe(false);
    expect(result.pricedCount).toBe(0);
  });

  it("1 kandidat -> koristi njegovu cijenu direktno, bez oznake prosjeka", () => {
    const result = computeAveragePrice([{ product: testProduct({ id: "1", name: "x", price: 2.5 }), basis: "l", unitPrice: 2.5 }]);
    expect(result.unitPrice).toBe(2.5);
    expect(result.usedAverage).toBe(false);
    expect(result.pricedCount).toBe(1);
  });

  it("outlier scenarij (5 kandidata, jedan 20-30x skuplji): trimmed mean ne dopušta da outlier dominira", () => {
    const prices = [1.0, 1.1, 1.2, 1.3, 30.0]; // npr. Nivea losion među mlijekom
    const candidates = prices.map((p, i) => ({
      product: testProduct({ id: String(i), name: "x", price: p }),
      basis: "l" as const,
      unitPrice: p,
    }));
    const result = computeAveragePrice(candidates);
    const plainMean = prices.reduce((a, b) => a + b, 0) / prices.length;

    expect(result.usedAverage).toBe(true);
    expect(result.trimmedOutCount).toBeGreaterThan(0);
    expect(result.unitPrice).not.toBeNull();
    expect(result.unitPrice as number).toBeLessThan(plainMean);
    // ostaje blizu stvarnog raspona (1.0-1.3), ne odvučen prema 30
    expect(result.unitPrice as number).toBeLessThan(2);
  });

  it("mali uzorak (n<=4) koristi običnu aritmetičku sredinu, bez odsijecanja", () => {
    const prices = [1.0, 2.0, 3.0];
    const candidates = prices.map((p, i) => ({
      product: testProduct({ id: String(i), name: "x", price: p }),
      basis: "kg" as const,
      unitPrice: p,
    }));
    const result = computeAveragePrice(candidates);
    expect(result.trimmedOutCount).toBe(0);
    expect(result.unitPrice).toBeCloseTo(2.0);
  });
});

describe("calculatePurchaseQuantity - FIX 2 zaokruživanje na pakiranja", () => {
  it("količina manja od najmanjeg pakiranja -> kupuje 1 najmanje pakiranje koje pokriva", () => {
    const result = calculatePurchaseQuantity(0.2, [0.5, 1, 2]); // 200 ml, pakiranja 0.5/1/2 l
    expect(result.purchaseQuantity).toBeGreaterThanOrEqual(0.2);
    expect(result.purchaseQuantity).toBe(0.5);
    expect(result.packages).toEqual([{ size: 0.5, count: 1 }]);
  });

  it("količina koja zahtijeva više pakiranja -> pokrivena najmanjom ukupnom kombinacijom", () => {
    const result = calculatePurchaseQuantity(1.3, [0.5, 1, 2, 5]); // 1,3 kg brašna
    expect(result.purchaseQuantity).toBeGreaterThanOrEqual(1.3);
    expect(result.purchaseQuantity).toBeCloseTo(1.5); // 1 + 0.5, najmanja suma >= 1.3
  });

  it("'kom' kategorija (jaja): 10 kom s pakiranjima 6 i 10 -> kupuje 10, nikad samo 1x6", () => {
    const result = calculatePurchaseQuantity(10, [6, 10]);
    expect(result.purchaseQuantity).toBe(10);
    expect(result.packages).toEqual([{ size: 10, count: 1 }]);
  });

  it("'kom' kategorija: 7 kom s pakiranjima 6 i 10 -> nikad manje od 7 (ni 1x6=6)", () => {
    const result = calculatePurchaseQuantity(7, [6, 10]);
    expect(result.purchaseQuantity).toBeGreaterThanOrEqual(7);
  });

  it("invarijanta purchaseQuantity >= neededQuantity vrijedi za raspon slučajeva", () => {
    const cases: Array<[number, number[]]> = [
      [0.2, [0.5, 1, 2]],
      [1.3, [0.5, 1, 2, 5]],
      [10, [6, 10]],
      [7, [6, 10]],
      [3.7, [1, 2, 5]],
      [0.05, [1]],
    ];
    for (const [needed, sizes] of cases) {
      const result = calculatePurchaseQuantity(needed, sizes);
      expect(result.purchaseQuantity).toBeGreaterThanOrEqual(needed);
    }
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

describe("priceIngredientPart - 0 kandidata nikad tiho ne postane 0", () => {
  it("vraća cijenu nedostupnu kad nema kandidata", () => {
    const index = buildProductIndex([]);
    const result = priceIngredientPart(index, "nepostojeca namirnica", 1, "kom");
    expect(result.itemPrice).toBeNull();
  });
});

describe("priceShoppingItem - složeni sastojci se više ne gube (audit N5)", () => {
  it("cijeni OBA dijela 'mrkva i celer' i zbraja ih", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Mrkva 1kg", price: 0.99, unit: "kg", unit_price: 0.99 }),
      testProduct({ id: "2", name: "Celer korijen 500g", price: 1.2, unit: "kg", unit_price: 2.4 }),
    ]);
    const result = priceShoppingItem(index, { name: "mrkva i celer", quantity: 0.3, unit: "kg" });
    expect(result.mode).toBe("and");
    expect(result.parts).toHaveLength(2);
    expect(result.parts.every((p) => p.itemPrice !== null)).toBe(true);
    expect(result.totalPrice).not.toBeNull();
  });

  it("za 'ili' spojeve bira jeftiniju cijenjenu alternativu", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Kiselo vrhnje 200ml", price: 1.0, unit: "l", unit_price: 5.0 }),
      testProduct({ id: "2", name: "Grčki jogurt 200g", price: 0.6, unit: "kg", unit_price: 3.0 }),
    ]);
    const result = priceShoppingItem(index, { name: "kiselo vrhnje ili grčki jogurt", quantity: 0.2, unit: "kg" });
    expect(result.mode).toBe("or");
    expect(result.chosenPartIndex).toBe(1); // grčki jogurt je jeftiniji
  });
});
