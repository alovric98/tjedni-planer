import { supabase } from "@/lib/supabase";
import type { ParsedProduct } from "./types";

const CHUNK_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function replaceStoreProducts(
  store: "lidl" | "kaufland",
  products: ParsedProduct[]
): Promise<void> {
  const { error: deleteError } = await supabase.from("products").delete().eq("store", store);
  if (deleteError) {
    throw new Error(`Brisanje starih proizvoda (${store}) nije uspjelo: ${deleteError.message}`);
  }

  for (const batch of chunk(products, CHUNK_SIZE)) {
    const { error: insertError } = await supabase.from("products").insert(
      batch.map((p) => ({ ...p, store }))
    );
    if (insertError) {
      throw new Error(`Upis proizvoda (${store}) nije uspio: ${insertError.message}`);
    }
  }
}

export async function logFetch(
  store: "lidl" | "kaufland",
  status: "success" | "error",
  productCount: number | null,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase.from("price_fetch_log").insert({
    store,
    status,
    product_count: productCount,
    error_message: errorMessage ?? null,
  });
  if (error) {
    console.error(`Greška kod zapisivanja price_fetch_log (${store}): ${error.message}`);
  }
}
