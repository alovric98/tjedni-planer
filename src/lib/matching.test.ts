import { describe, it, expect } from "vitest";
import { buildProductIndex, matchProductCandidates, matchProduct } from "@/lib/matching";
import { testProduct } from "@/lib/test-helpers";

describe("matchProductCandidates - prag pouzdanosti + kategorijski filtar (FIX 1, korak 0)", () => {
  it("isključuje kandidate izvan hrane/pića (audit N1: 'mlijeko' -> Nivea losion)", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Nivea mlijeko za tijelo Q10 400 ml", price: 12.39, category: "KOZMETIKA" }),
      testProduct({ id: "2", name: "Dukat trajno mlijeko 1L", price: 0.99, unit: "l", unit_price: 0.99 }),
    ]);
    const candidates = matchProductCandidates(index, "mlijeko");
    expect(candidates.map((c) => c.product.id)).toEqual(["2"]);
  });

  it("ne baca kandidata s nepoznatom kategorijom (ne može se provjeriti, pa se ne odbacuje)", () => {
    const index = buildProductIndex([testProduct({ id: "1", name: "Svježe mlijeko 1L", price: 1.1, category: null })]);
    expect(matchProductCandidates(index, "mlijeko")).toHaveLength(1);
  });

  it("vraća prazno kad glavna imenica uopće nema veze s upitom", () => {
    const index = buildProductIndex([testProduct({ id: "1", name: "Integralna tjestenina Penne 500g", price: 1.5 })]);
    expect(matchProductCandidates(index, "mrkva")).toHaveLength(0);
  });

  it("ne pogađa 'jaja' u nazivu 'tjestenina bez jaja' (negacijski filtar za 'bez X' fraze)", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Barilla tjestenina bez jaja 500g", price: 2.5 }),
      testProduct({ id: "2", name: "Svježa jaja 10 kom", price: 2.1 }),
    ]);
    const candidates = matchProductCandidates(index, "jaja");
    expect(candidates.map((c) => c.product.id)).toEqual(["2"]);
  });

  it("negacija djeluje i kad je negirani proizvod jedini kandidat (rezultat prazan, ne pogrešan pogodak)", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Tjestenina bez jaja Penne 500g", price: 2.5 }),
    ]);
    expect(matchProductCandidates(index, "jaja")).toHaveLength(0);
  });

  it("matchProduct je tanki wrapper - vraća najbolji kandidat ili null", () => {
    const index = buildProductIndex([testProduct({ id: "1", name: "Dukat trajno mlijeko 1L", price: 0.99 })]);
    expect(matchProduct(index, "mlijeko")?.id).toBe("1");
    expect(matchProduct(index, "nepostojeca namirnica xyz")).toBeNull();
  });
});
