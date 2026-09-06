"use client";

import { useState } from "react";
import { formatQuantity } from "@/lib/format";

export type BasketRow = {
  ingredient: string;
  quantity: number;
  unit: string;
  matchedName: string | null;
  calculatedPrice: number | null;
  packages: number;
  exact: boolean;
};

export type StoreBasket = {
  rows: BasketRow[];
  total: number;
  lastUpdated: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "nikad";
  return new Date(iso).toLocaleString("hr-HR", { dateStyle: "medium", timeStyle: "short" });
}

function BasketRowCard({ row }: { row: BasketRow }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm shadow-black/5">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{row.ingredient}</p>
        <p className="mt-0.5 truncate text-sm text-ink-muted">
          {row.matchedName ? (
            <>
              {row.matchedName}
              {row.packages > 1 && <span className="ml-1 text-xs">× {row.packages}</span>}
            </>
          ) : (
            <span className="text-accent-red-ink">nije pronađeno</span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-ink-muted">
          {formatQuantity(row.quantity)} {row.unit}
        </p>
        <p className="font-semibold text-ink">
          {row.calculatedPrice !== null
            ? `${row.exact ? "" : "~"}${row.calculatedPrice.toFixed(2)} €`
            : "—"}
        </p>
      </div>
    </div>
  );
}

function BasketView({ basket }: { basket: StoreBasket }) {
  return (
    <div>
      <div className="rounded-3xl bg-accent-green p-5">
        <p className="text-sm font-semibold text-accent-green-ink">Ukupno za tjedan</p>
        <p className="mt-1 text-3xl font-bold text-ink">{basket.total.toFixed(2)} €</p>
        <p className="mt-2 text-xs text-accent-green-ink/80">
          Zadnje osvježeno: {formatDate(basket.lastUpdated)}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {basket.rows.map((row, i) => (
          <BasketRowCard key={i} row={row} />
        ))}
      </div>

      {basket.rows.some((r) => r.calculatedPrice !== null && !r.exact) && (
        <p className="mt-3 text-xs text-ink-muted">
          ~ cijena jednog pakiranja (ne znamo točnu veličinu pakiranja pa ne možemo izračunati
          treba li ih više)
        </p>
      )}
    </div>
  );
}

export function StoreTabs({ lidl, kaufland }: { lidl: StoreBasket; kaufland: StoreBasket }) {
  const [store, setStore] = useState<"lidl" | "kaufland">("lidl");

  return (
    <div className="mt-4">
      <div className="inline-flex gap-1 rounded-full bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setStore("lidl")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
            store === "lidl" ? "bg-brand-dark text-white" : "text-ink-muted"
          }`}
        >
          Lidl
        </button>
        <button
          type="button"
          onClick={() => setStore("kaufland")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
            store === "kaufland" ? "bg-brand-dark text-white" : "text-ink-muted"
          }`}
        >
          Kaufland
        </button>
      </div>

      <div className="mt-4">
        <BasketView basket={store === "lidl" ? lidl : kaufland} />
      </div>
    </div>
  );
}
