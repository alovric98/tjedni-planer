import type { Metadata } from "next";
import { generateShoppingList, type ShoppingListItem } from "../tjedni-plan/actions";
import { getAllProducts } from "@/lib/products";
import { buildProductIndex } from "@/lib/matching";
import { priceShoppingItem, type BasketLineResult } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { StoreTabs, type StoreBasket } from "./StoreTabs";

export const metadata: Metadata = { title: "Košarica" };

// Ovisi o podacima koji se mijenjaju izvan ove stranice (cron dnevno puni
// products, recepti/tjedni plan se mijenjaju na drugim stranicama) - statički
// snapshot s builda bi ostao zauvijek zastario bez ovoga.
export const dynamic = "force-dynamic";

// Cjenik se dohvaća jednom dnevno (cron u 9:00). Stariji od 24h znači da je
// dnevni dohvat propao - dodatni bug iz audita: Lidlov dohvat je bio mrtav 7
// dana, a UI je stare cijene prikazivao kao svježe, bez ikakve naznake.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function isStale(lastSuccess: string | null): boolean {
  if (!lastSuccess) return true;
  return Date.now() - new Date(lastSuccess).getTime() > STALE_AFTER_MS;
}

async function buildBasket(store: "lidl" | "kaufland", items: ShoppingListItem[]): Promise<Omit<StoreBasket, "lastUpdated" | "isStale">> {
  const products = await getAllProducts(store);
  const index = buildProductIndex(products);

  const rows: BasketLineResult[] = items.map((item) => priceShoppingItem(index, item));

  const pricedRows = rows.filter((r) => r.totalPrice !== null);
  const total = round2(pricedRows.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0));

  return { rows, total, unpricedCount: rows.length - pricedRows.length };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function KosaricaPage() {
  const items = await generateShoppingList();

  if (items.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">Košarica</h1>
        <p className="mt-2 text-ink-muted">
          Nema sastojaka - odaberi recepte za tjedan na tabu &quot;Tjedni plan&quot;.
        </p>
      </div>
    );
  }

  const [lidlPartial, kauflandPartial, { data: logs }] = await Promise.all([
    buildBasket("lidl", items),
    buildBasket("kaufland", items),
    supabase
      .from("price_fetch_log")
      .select("store, fetched_at")
      .eq("status", "success")
      .order("fetched_at", { ascending: false }),
  ]);

  const lastSuccess = (store: string) => logs?.find((l) => l.store === store)?.fetched_at ?? null;

  const lidlLastUpdated = lastSuccess("lidl");
  const kauflandLastUpdated = lastSuccess("kaufland");

  const lidlBasket: StoreBasket = { ...lidlPartial, lastUpdated: lidlLastUpdated, isStale: isStale(lidlLastUpdated) };
  const kauflandBasket: StoreBasket = { ...kauflandPartial, lastUpdated: kauflandLastUpdated, isStale: isStale(kauflandLastUpdated) };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Košarica</h1>
      <StoreTabs lidl={lidlBasket} kaufland={kauflandBasket} />
    </div>
  );
}
