import type { ProductForMatching } from "@/lib/products";

/** Minimalni test-fixture za proizvod iz cjenika - podrazumijeva HRANA kategoriju. */
export function testProduct(
  overrides: Partial<ProductForMatching> & { id: string; name: string; price: number }
): ProductForMatching {
  return {
    brand: null,
    unit: null,
    unit_price: null,
    net_quantity: null,
    category: "HRANA",
    ...overrides,
  };
}
