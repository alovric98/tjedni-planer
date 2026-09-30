import type { StoreKey } from "@/config/store-options";

export type StoreBranch = {
  /** Stabilan identifikator iz javnog cjenika (Lidl: broj poslovnice, Kaufland: šifra). */
  key: string;
  /** Tekst za prikaz korisniku. */
  label: string;
};

const LIDL_LIST_PAGE_URL = "https://www.lidl.hr/c/cijene/s10073252";
const KAUFLAND_LIST_URL = "https://www.kaufland.hr/akcije-novosti/popis-mpc.assetSearch.id=assetList_1599847924.json";

// "Supermarket <broj>_<ulica>_<kbr>_<pošt.br>_<grad>_<kod>_DD.MM.YYYY_H.MMh.csv"
const LIDL_FILE_PATTERN =
  /webPriceData\/hr\/Supermarket (\d+)_(.+?)_([^_]+)_\d{5}_([^_]+)_[^_]+_\d{2}\.\d{2}\.\d{4}_\d{1,2}\.\d{2}h\.csv/g;

// "<Tip>_<ulica_i_grad>_<šifra>_DDMMYYYY_7-30.csv". Ispravljene verzije
// cjenika imaju prefiks brojke ispred tipa ("1Hipermarket_..."), pa se on ignorira.
const KAUFLAND_FILE_PATTERN = /^\d*[A-Za-z]+_(.+)_(\d+)_\d{8}_[\d-]+\.csv$/;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sortByLabel(branches: Map<string, StoreBranch>): StoreBranch[] {
  return [...branches.values()].sort((a, b) => a.label.localeCompare(b.label, "hr"));
}

/** Popis stranica prikazuje povijest svih poslovnica, pa se duplikati spajaju po broju poslovnice. */
export function parseLidlBranches(html: string): StoreBranch[] {
  const branches = new Map<string, StoreBranch>();
  for (const match of html.matchAll(LIDL_FILE_PATTERN)) {
    const [, key, street, houseNumber, city] = match;
    if (branches.has(key)) continue;
    branches.set(key, { key, label: `${safeDecode(city)}, ${safeDecode(street)} ${safeDecode(houseNumber)}` });
  }
  return sortByLabel(branches);
}

/** Popis sadrži povijest datoteka za sve poslovnice, pa se duplikati spajaju po šifri poslovnice. */
export function parseKauflandBranches(entries: { label?: unknown }[]): StoreBranch[] {
  const branches = new Map<string, StoreBranch>();
  for (const entry of entries) {
    if (typeof entry.label !== "string") continue;
    const match = KAUFLAND_FILE_PATTERN.exec(entry.label);
    if (!match) continue;
    const [, slug, key] = match;
    if (branches.has(key)) continue;
    branches.set(key, { key, label: slug.replace(/_+/g, " ").trim() });
  }
  return sortByLabel(branches);
}

async function fetchLidlBranches(): Promise<StoreBranch[]> {
  const res = await fetch(LIDL_LIST_PAGE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Lidl stranica s cjenicima nedostupna (HTTP ${res.status})`);
  return parseLidlBranches(await res.text());
}

async function fetchKauflandBranches(): Promise<StoreBranch[]> {
  const res = await fetch(KAUFLAND_LIST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Kaufland popis cjenika nedostupan (HTTP ${res.status})`);
  return parseKauflandBranches(await res.json());
}

const FETCHERS: Partial<Record<StoreKey, () => Promise<StoreBranch[]>>> = {
  lidl: fetchLidlBranches,
  kaufland: fetchKauflandBranches,
};

// Izvorne datoteke su 1-2 MB (preveliko za Next data cache), a popis
// poslovnica se praktički ne mijenja - drži se u memoriji procesa nekoliko sati.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<StoreKey, { at: number; branches: StoreBranch[] }>();

/**
 * Poslovnice trgovine iz javnog cjenika. Vraća [] ako popis nije dostupan -
 * pozivatelj tada ne smije blokirati korisnika (lokacija je opcionalna).
 */
export async function getBranches(store: StoreKey): Promise<StoreBranch[]> {
  const fetcher = FETCHERS[store];
  if (!fetcher) return [];

  const cached = cache.get(store);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.branches;

  try {
    const branches = await fetcher();
    if (branches.length > 0) cache.set(store, { at: Date.now(), branches });
    return branches;
  } catch (error) {
    console.error(`Dohvat poslovnica nije uspio (${store}):`, error);
    return cached?.branches ?? [];
  }
}
