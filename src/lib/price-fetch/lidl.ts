import JSZip from "jszip";
import { parse } from "csv-parse/sync";
import { LIDL_STORE_MATCH } from "@/config/stores";
import { parseNumber, stripBom } from "./parse-utils";
import type { ParsedProduct, UnitBasis } from "./types";

const LIST_PAGE_URL = "https://tvrtka.lidl.hr/cijene";

function classifyUnitBasis(raw: string | undefined): UnitBasis | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();

  const numberCount = (text.match(/\d+[.,]?\d*/g) ?? []).length;
  if (numberCount !== 1) return null; // višestruke varijante u istom polju - nejasno

  if (/komad/.test(text)) return "kom";
  if (/ml$/.test(text)) return "l";
  if (/kg$/.test(text)) return "kg";
  if (/l$/.test(text)) return "l";
  if (/g$/.test(text)) return "kg";
  return null;
}

async function findTodaysZipUrl(date: Date): Promise<string> {
  const res = await fetch(LIST_PAGE_URL);
  if (!res.ok) {
    throw new Error(`Lidl stranica s cjenicima nedostupna (HTTP ${res.status})`);
  }
  const html = await res.text();

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  const pattern = new RegExp(
    `https://tvrtka\\.lidl\\.hr/content/download/\\d+/fileupload/Popis_cijena_po_trgovinama_na_dan_${dd}_${mm}_${yyyy}\\.zip`
  );
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`Nije pronađen link za današnji Lidl cjenik (${dd}.${mm}.${yyyy}.)`);
  }
  return match[0];
}

export async function fetchLidlProducts(date: Date = new Date()): Promise<ParsedProduct[]> {
  const zipUrl = await findTodaysZipUrl(date);

  const zipRes = await fetch(zipUrl);
  if (!zipRes.ok) {
    throw new Error(`Preuzimanje Lidl ZIP-a nije uspjelo (HTTP ${zipRes.status})`);
  }
  const zipBuffer = await zipRes.arrayBuffer();

  const zip = await JSZip.loadAsync(zipBuffer);
  const entryName = Object.keys(zip.files).find((name) => name.includes(LIDL_STORE_MATCH));
  if (!entryName) {
    throw new Error(`Nije pronađena poslovnica "${LIDL_STORE_MATCH}" u Lidl ZIP-u`);
  }

  const entryBuffer = await zip.files[entryName].async("arraybuffer");
  const text = new TextDecoder("windows-1250").decode(stripBom(entryBuffer));

  const rows: string[][] = parse(text, {
    delimiter: ",",
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  const dataRows = rows.slice(1); // makni header

  const products: ParsedProduct[] = [];

  for (const row of dataRows) {
    const name = row[0]?.trim();
    const price = parseNumber(row[6]) ?? parseNumber(row[5]);
    if (!name || price === null) continue;

    products.push({
      code: row[1]?.trim() || null,
      barcode: row[9]?.trim() || null,
      name,
      brand: row[4]?.trim() || null,
      net_quantity: parseNumber(row[2]),
      unit: classifyUnitBasis(row[3]),
      price,
      unit_price: parseNumber(row[8]),
      category: row[10]?.trim() || null,
    });
  }

  return products;
}
