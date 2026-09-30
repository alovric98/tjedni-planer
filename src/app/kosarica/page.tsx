import type { Metadata } from "next";
import Link from "next/link";
import { generateShoppingList, type ShoppingListItem } from "../tjedni-plan/actions";
import { getAllProducts } from "@/lib/products";
import { buildProductIndex } from "@/lib/matching";
import { mergeItemsByRule, priceShoppingItem, type BasketLineResult } from "@/lib/pricing";
import { findIngredientRule } from "@/config/ingredient-rules";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { STORE_OPTIONS, type StoreKey } from "@/config/store-options";
import { StoreTabs, type StoreBasket, type StoreEntry } from "./StoreTabs";

export const metadata: Metadata = { title: "Košarica" };

// Ovisi o podacima koji se mijenjaju izvan ove stranice (cron dnevno puni
// products, recepti/tjedni plan se mijenjaju na drugim stranicama) - statički
// snapshot s builda bi ostao zauvijek zastario bez ovoga.
export const dynamic = "force-dynamic";

// Cjenik se dohvaća jednom dnevno (cron u 9:00). Stariji od 24h znači da je
// dnevni dohvat propao - dodatni bug iz audita: Lidlov dohvat je bio mrtav 7
// dana, a UI je stare cijene prikazivao kao svježe, bez ikakve naznake.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// Danas jedine trgovine s live cijenama - kad Tommy/Studenac/Konzum dobiju
// price-fetch, dodaju se ovdje bez promjene filtriranja/prikaza ispod.
const LIVE_STORES: Array<"lidl" | "kaufland"> = ["lidl", "kaufland"];

function isStale(lastSuccess: string | null): boolean {
  if (!lastSuccess) return true;
  return Date.now() - new Date(lastSuccess).getTime() > STALE_AFTER_MS;
}

async function buildBasket(store: "lidl" | "kaufland", items: ShoppingListItem[]): Promise<Omit<StoreBasket, "lastUpdated" | "isStale">> {
  const products = await getAllProducts(store);
  const index = buildProductIndex(products);

  const rows: BasketLineResult[] = mergeItemsByRule(items, findIngredientRule).map((item) =>
    priceShoppingItem(index, item, findIngredientRule)
  );

  const pricedRows = rows.filter((r) => r.totalPrice !== null);
  const total = round2(pricedRows.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0));

  return { rows, total, unpricedCount: rows.length - pricedRows.length };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div>
      <h1 className="text-title text-ink">Košarica</h1>
      <p className="mt-2 text-warn">Greška kod dohvata košarice: {message}</p>
    </div>
  );
}

export default async function KosaricaPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  let enabledStoreKeys: Array<"lidl" | "kaufland"> = LIVE_STORES;
  if (user) {
    const { data: userStores } = await authClient
      .from("user_stores")
      .select("store_key")
      .eq("user_id", user.id)
      .eq("enabled", true);

    const selected = (userStores ?? []).map((r) => r.store_key as StoreKey);
    enabledStoreKeys = LIVE_STORES.filter((key) => selected.includes(key));

    // TODO(premium-gate): kad postoji billing, ovdje provjeriti
    // profiles.is_premium prije prikaza cijena u Košarici (free korisnici
    // bi vidjeli samo popis bez usporedbe cijena) - stupac već postoji,
    // logika još nije uključena.
  }

  if (enabledStoreKeys.length === 0) {
    return (
      <div>
        <h1 className="text-title text-ink">Košarica</h1>
        <p className="mt-2 text-ink-muted">
          Nemaš odabranu nijednu trgovinu s live cijenama.{" "}
          <Link href="/onboarding" className="font-semibold text-accent-fg underline underline-offset-2">
            Uredi odabir trgovina
          </Link>
          .
        </p>
      </div>
    );
  }

  let items: ShoppingListItem[];
  try {
    items = await generateShoppingList();
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Nepoznata greška"} />;
  }

  if (items.length === 0) {
    return (
      <div>
        <h1 className="text-title text-ink">Košarica</h1>
        <p className="mt-2 text-ink-muted">
          Nema sastojaka - odaberi recepte za tjedan na tabu &quot;Tjedni plan&quot;.
        </p>
      </div>
    );
  }

  let logs: { store: string; fetched_at: string }[] | null;
  const basketsByKey = new Map<StoreKey, Omit<StoreBasket, "lastUpdated" | "isStale">>();
  try {
    const [basketResults, logResult] = await Promise.all([
      Promise.all(enabledStoreKeys.map((key) => buildBasket(key, items))),
      supabase
        .from("price_fetch_log")
        .select("store, fetched_at")
        .eq("status", "success")
        .order("fetched_at", { ascending: false }),
    ]);
    logs = logResult.data;
    enabledStoreKeys.forEach((key, i) => {
      basketsByKey.set(key, basketResults[i]);
    });
  } catch (e) {
    return <ErrorState message={e instanceof Error ? e.message : "Nepoznata greška"} />;
  }

  const lastSuccess = (store: string) => logs?.find((l) => l.store === store)?.fetched_at ?? null;

  const STORE_LABELS: Record<StoreKey, string> = Object.fromEntries(
    STORE_OPTIONS.map((s) => [s.key, s.label])
  ) as Record<StoreKey, string>;

  const stores: StoreEntry[] = enabledStoreKeys.map((key) => {
    const partial = basketsByKey.get(key)!;
    const lastUpdated = lastSuccess(key);
    return {
      key,
      label: STORE_LABELS[key],
      basket: { ...partial, lastUpdated, isStale: isStale(lastUpdated) },
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title text-ink">Košarica</h1>
        <Link href="/onboarding" className="text-sm font-semibold text-ink-muted underline underline-offset-2">
          Uredi odabir trgovina
        </Link>
      </div>
      <StoreTabs stores={stores} />
    </div>
  );
}
