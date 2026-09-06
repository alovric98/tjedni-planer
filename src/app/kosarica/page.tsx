import type { Metadata } from "next";
import { generateShoppingList, type ShoppingListItem } from "../tjedni-plan/actions";
import { getAllProducts } from "@/lib/products";
import { buildProductIndex, matchProduct, calculateItemPrice } from "@/lib/matching";
import { supabase } from "@/lib/supabase";
import { StoreTabs, type StoreBasket } from "./StoreTabs";

export const metadata: Metadata = { title: "Košarica" };

// Ovisi o podacima koji se mijenjaju izvan ove stranice (cron dnevno puni
// products, recepti/tjedni plan se mijenjaju na drugim stranicama) - statički
// snapshot s builda bi ostao zauvijek zastario bez ovoga.
export const dynamic = "force-dynamic";

async function buildBasket(
  store: "lidl" | "kaufland",
  items: ShoppingListItem[]
): Promise<StoreBasket> {
  const products = await getAllProducts(store);
  const index = buildProductIndex(products);

  const rows = items.map((item) => {
    const product = matchProduct(index, item.name);

    if (!product) {
      return {
        ingredient: item.name,
        quantity: item.quantity,
        unit: item.unit,
        matchedName: null,
        calculatedPrice: null,
        packages: 1,
        exact: true,
      };
    }

    const estimate = calculateItemPrice(item, product);
    const brand = product.brand && product.brand !== "#" ? product.brand : null;

    return {
      ingredient: item.name,
      quantity: item.quantity,
      unit: item.unit,
      matchedName: brand ? `${product.name} (${brand})` : product.name,
      calculatedPrice: estimate.price,
      packages: estimate.packages,
      exact: estimate.exact,
    };
  });

  const total = rows.reduce((sum, row) => sum + (row.calculatedPrice ?? 0), 0);

  return { rows, total: Math.round(total * 100) / 100, lastUpdated: null };
}

export default async function KosaricaPage() {
  const items = await generateShoppingList();

  if (items.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Košarica</h1>
        <p className="mt-2 text-gray-500">
          Nema sastojaka - odaberi recepte za tjedan na tabu &quot;Tjedni plan&quot;.
        </p>
      </div>
    );
  }

  const [lidlBasket, kauflandBasket, { data: logs }] = await Promise.all([
    buildBasket("lidl", items),
    buildBasket("kaufland", items),
    supabase
      .from("price_fetch_log")
      .select("store, fetched_at")
      .eq("status", "success")
      .order("fetched_at", { ascending: false }),
  ]);

  const lastSuccess = (store: string) => logs?.find((l) => l.store === store)?.fetched_at ?? null;

  lidlBasket.lastUpdated = lastSuccess("lidl");
  kauflandBasket.lastUpdated = lastSuccess("kaufland");

  return (
    <div>
      <h1 className="text-xl font-semibold">Košarica</h1>
      <StoreTabs lidl={lidlBasket} kaufland={kauflandBasket} />
    </div>
  );
}
