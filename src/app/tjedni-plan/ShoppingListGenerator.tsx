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
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Generiram…" : "Generiraj popis za kupovinu"}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {items && (
        <div className="mt-4">
          <h2 className="text-sm font-medium text-gray-700">Popis za kupovinu</h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Nema odabranih recepata za tjedan.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
              {items.map((item, i) => (
                <li key={i}>
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
