"use client";

import { useState, useTransition } from "react";
import { formatQuantity } from "@/lib/format";
import { generateShoppingList, type ShoppingListItem } from "./actions";

export function ShoppingListGenerator() {
  const [items, setItems] = useState<ShoppingListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const result = await generateShoppingList();
              setItems(result);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Greška kod generiranja popisa.");
            }
          });
        }}
        className="rounded-full bg-brand-dark px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Generiram…" : "Generiraj popis za kupovinu"}
      </button>

      {error && <p className="mt-2 text-sm text-accent-red-ink">{error}</p>}

      {items && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-ink">Popis za kupovinu</h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Nema odabranih recepata za tjedan.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 rounded-3xl bg-white p-5 text-sm text-ink-muted shadow-sm shadow-black/5">
              {items.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green-ink/40" />
                  {item.name} — {formatQuantity(item.quantity)} {item.unit}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
