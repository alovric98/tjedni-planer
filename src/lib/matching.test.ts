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

  it("kategorija se uspoređuje bez obzira na velika/mala slova (Lidl 'Hrana'/'Piće' naspram Kauflandovog 'HRANA'/'PIĆE')", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Dukat trajno mlijeko 1L", price: 0.99, category: "Hrana" }),
      testProduct({ id: "2", name: "Kokos mlijeko piće 1L", price: 1.99, category: "Piće" }),
      testProduct({ id: "3", name: "Nivea mlijeko za tijelo 400 ml", price: 12.39, category: "Kozmetika" }),
    ]);
    const candidates = matchProductCandidates(index, "mlijeko");
    expect(candidates.map((c) => c.product.id).sort()).toEqual(["1", "2"]);
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

  it("prepoznaje regionalni naziv 'biber' za Kauflandov 'papar' (sinonim rječnik)", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Kotanyi papar crni mljeveni 50g", price: 2.35 }),
    ]);
    const candidates = matchProductCandidates(index, "biber");
    expect(candidates.map((c) => c.product.id)).toEqual(["1"]);
  });

  it("'bez X' negacija vrijedi i preko sinonima - 'bez papar' ne pogađa upit 'biber'", () => {
    const index = buildProductIndex([testProduct({ id: "1", name: "Umak bez papar 200 g", price: 1.5 })]);
    expect(matchProductCandidates(index, "biber")).toHaveLength(0);
  });

  it("'karfiol' pogađa i 'Cvjetača' i 'KBio.Karfiol' (sinonim rječnik)", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "Cvjetača", price: 1.99 }),
      testProduct({ id: "2", name: "KBio.Karfiol 750g", price: 4.99 }),
      testProduct({ id: "3", name: "KLC.Salata od cvjetače 530g/300g", price: 2.69 }),
    ]);
    const candidates = matchProductCandidates(index, "karfiol");
    expect(candidates.map((c) => c.product.id).sort()).toEqual(["1", "2"]);
  });

  it("obrnuti upit 'cvjetača' također pogađa 'KBio.Karfiol', ali ne 'Salatu od cvjetače'", () => {
    const index = buildProductIndex([
      testProduct({ id: "1", name: "KLC.Cvjetača 450 g", price: 0.89 }),
      testProduct({ id: "2", name: "KBio.Karfiol 750g", price: 4.99 }),
      testProduct({ id: "3", name: "KLC.Salata od cvjetače 530g/300g", price: 2.69 }),
    ]);
    const candidates = matchProductCandidates(index, "cvjetača");
    expect(candidates.map((c) => c.product.id).sort()).toEqual(["1", "2"]);
  });

  it("matchProduct je tanki wrapper - vraća najbolji kandidat ili null", () => {
    const index = buildProductIndex([testProduct({ id: "1", name: "Dukat trajno mlijeko 1L", price: 0.99 })]);
    expect(matchProduct(index, "mlijeko")?.id).toBe("1");
    expect(matchProduct(index, "nepostojeca namirnica xyz")).toBeNull();
  });
});
