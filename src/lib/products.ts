import { supabase } from "./supabase";

const PAGE_SIZE = 1000;

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
  const all: ProductForMatching[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, brand, price, unit, unit_price, net_quantity")
      .eq("store", store)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Greška kod dohvata proizvoda (${store}): ${error.message}`);
    }
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
