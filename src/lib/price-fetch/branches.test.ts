import { describe, expect, it } from "vitest";
import { parseKauflandBranches, parseLidlBranches } from "./branches";

describe("parseLidlBranches", () => {
  const html = `
    <a href="/explore/assets/webPriceData/hr/Supermarket 105_Zeleno polje_8 A_31000_Osijek_1_30.09.2026_7.15h.csv">x</a>
    <a href="/explore/assets/webPriceData/hr/Supermarket 104_Ulica Dr. Franje Tuđmana_30_10450_Jastrebarsko_1_30.09.2026_7.15h.csv">x</a>
    <a href="/explore/assets/webPriceData/hr/Supermarket 104_Ulica Dr. Franje Tuđmana_30_10450_Jastrebarsko_1_29.09.2026_7.15h.csv">x</a>
  `;

  it("builds one branch per store number, with city and address in the label", () => {
    expect(parseLidlBranches(html)).toEqual([
      { key: "104", label: "Jastrebarsko, Ulica Dr. Franje Tuđmana 30" },
      { key: "105", label: "Osijek, Zeleno polje 8 A" },
    ]);
  });

  it("returns an empty list when the page has no price files", () => {
    expect(parseLidlBranches("<html></html>")).toEqual([]);
  });
});

describe("parseKauflandBranches", () => {
  const entries = [
    { label: "Hipermarket_Bistricka_6_Zagreb_3430_01102026_7-30.csv" },
    { label: "Hipermarket_114__Brigade_6_Split_1630_01102026_7-30.csv" },
    { label: "1Hipermarket_114__Brigade_6_Split_1630_01102026_7-30.csv" },
    { label: "Supermarket_Zagrebacka_3_Sisak_4430_30092026_7-30.csv" },
    { label: "not-a-price-file.pdf" },
    {},
  ];

  it("dedupes by branch code, ignores correction prefixes and invalid entries", () => {
    expect(parseKauflandBranches(entries)).toEqual([
      { key: "1630", label: "114 Brigade 6 Split" },
      { key: "3430", label: "Bistricka 6 Zagreb" },
      { key: "4430", label: "Zagrebacka 3 Sisak" },
    ]);
  });
});
