import { supabase } from "./supabase";

const PAGE_SIZE = 1000; // tvrdi limit koji Supabase/PostgREST vraća po pozivu

export type ProductForMatching = {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  unit: string | null;
  unit_price: number | null;
  net_quantity: number | null;
};

export async function getAllProducts(store: "lidl" | "kaufland"): Promise<ProductForMatching[]> {
  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store", store);

  if (countError) {
    throw new Error(`Greška kod dohvata proizvoda (${store}): ${countError.message}`);
  }
  if (!count) return [];

  const pageCount = Math.ceil(count / PAGE_SIZE);

  // Supabase vraća max 1000 redaka po pozivu, a kataloga ima ~15 000 - uz
  // sekvencijalno straničenje to je 15+ poziva jedan za drugim (sporo,
  // pogotovo na mobitelu/produkciji). Dohvat svih stranica ODJEDNOM (umjesto
  // jedne pa čekaj pa sljedeće) skraćuje čekanje s "zbroj svih poziva" na
  // "trajanje jednog", jer idu paralelno.
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      supabase
        .from("products")
        .select("id, name, brand, price, unit, unit_price, net_quantity")
        .eq("store", store)
        .range(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE - 1)
    )
  );

  const all: ProductForMatching[] = [];
  for (const { data, error } of pages) {
    if (error) {
      throw new Error(`Greška kod dohvata proizvoda (${store}): ${error.message}`);
    }
    if (data) all.push(...data);
  }

  return all;
}
