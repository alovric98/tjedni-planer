import { parse } from "csv-parse/sync";
import { buildKauflandCsvUrl } from "@/config/stores";
import { parseNumber } from "./parse-utils";
import type { ParsedProduct, UnitBasis } from "./types";

function mapUnitBasis(raw: string | undefined): UnitBasis | null {
  const value = raw?.trim().toUpperCase();
  if (value === "KG") return "kg";
  if (value === "L") return "l";
  if (value === "KOM") return "kom";
  return null;
}

export async function fetchKauflandProducts(date: Date = new Date()): Promise<ParsedProduct[]> {
  const url = buildKauflandCsvUrl(date);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Kaufland cjenik nedostupan (HTTP ${res.status}) na ${url}`);
  }

  const buffer = await res.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buffer);

  const rows: string[][] = parse(text, {
    delimiter: "\t",
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    quote: false,
  });

  const dataRows = rows.slice(1); // makni header

  const products: ParsedProduct[] = [];

  for (const row of dataRows) {
    const name = row[0]?.trim();
    const price = parseNumber(row[5]);
    if (!name || price === null) continue;

    products.push({
      code: row[1]?.trim() || null,
      barcode: row[13]?.trim() || null,
      name,
      brand: row[2]?.trim() || null,
      net_quantity: parseNumber(row[3]),
      unit: mapUnitBasis(row[8]),
      price,
      unit_price: parseNumber(row[9]),
      category: row[14]?.trim() || null,
    });
  }

  return products;
}
