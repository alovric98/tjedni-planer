import { parse } from "csv-parse/sync";
import { LIDL_STORE_MATCH } from "@/config/stores";
import { parseNumber } from "./parse-utils";
import type { ParsedProduct, UnitBasis } from "./types";

// Lidlova stara /cijene stranica (tvrtka.lidl.hr) je prestala raditi - link
// za dnevni ZIP je nestao (audit N4). Zamjena, potvrđena uživo 30.09.2026:
// www.lidl.hr/c/cijene/s10073252 je zakonom propisana (NN 75/2025) stranica
// s dnevnim cjenicima PO POSLOVNICI kao pojedinačni CSV-ovi (isti obrazac
// transparentnosti cijena kao i Kaufland), format datoteke:
// "Supermarket <broj>_<ulica>_<kbr>_<pošt.br>_<grad>_<kod>_DD.MM.YYYY_H.MMh.csv".
const LIST_PAGE_URL = "https://www.lidl.hr/c/cijene/s10073252";

// Hvata svaki <a href="/explore/assets/webPriceData/hr/...csv"> link na
// stranici i izvlači datum iz imena datoteke (uvijek na kraju, prije
// vremena objave). Stranica prikazuje POVIJEST zadnjih nekoliko tjedana za
// SVE poslovnice odjednom, pa se filtrira i po datumu i po poslovnici.
const CSV_LINK_PATTERN =
  /href="(\/explore\/assets\/webPriceData\/hr\/[^"]+?_(\d{2})\.(\d{2})\.(\d{4})_\d{1,2}\.\d{2}h\.csv)"/g;

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

async function findTodaysCsvUrl(date: Date): Promise<string> {
  const res = await fetch(LIST_PAGE_URL);
  if (!res.ok) {
    throw new Error(`Lidl stranica s cjenicima nedostupna (HTTP ${res.status})`);
  }
  const html = await res.text();

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());

  CSV_LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CSV_LINK_PATTERN.exec(html))) {
    const [, href, linkDd, linkMm, linkYyyy] = match;
    if (linkDd === dd && linkMm === mm && linkYyyy === yyyy && href.includes(LIDL_STORE_MATCH)) {
      return new URL(href, LIST_PAGE_URL).toString();
    }
  }
  throw new Error(
    `Nije pronađen link za današnji Lidl cjenik (${dd}.${mm}.${yyyy}.) za poslovnicu "${LIDL_STORE_MATCH}"`
  );
}

export async function fetchLidlProducts(date: Date = new Date()): Promise<ParsedProduct[]> {
  const csvUrl = await findTodaysCsvUrl(date);

  const csvRes = await fetch(csvUrl);
  if (!csvRes.ok) {
    throw new Error(`Preuzimanje Lidl cjenika nije uspjelo (HTTP ${csvRes.status})`);
  }
  const buffer = await csvRes.arrayBuffer();
  const text = new TextDecoder("windows-1250").decode(buffer);

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
    // MALOPRODAJNA_CIJENA (redovna cijena) - ista kolona kao Kauflandova
    // "maloprod.cijena(EUR)" (kaufland.ts row[5]), NE promotivna
    // MPC_ZA_VRIJEME_POSEBNOG_OBLIKA_PRODAJE - da usporedba Lidl/Kaufland
    // bude na istoj osnovi (obje trgovine redovna cijena, ne akcijska).
    const price = parseNumber(row[5]);
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
