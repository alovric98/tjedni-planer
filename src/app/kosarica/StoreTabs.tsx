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

function BasketTable({ basket }: { basket: StoreBasket }) {
  return (
    <div>
      <p className="text-xs text-gray-400">Zadnje osvježeno: {formatDate(basket.lastUpdated)}</p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="p-2">Sastojak</th>
              <th className="p-2">Proizvod</th>
              <th className="p-2 text-right">Potrebno</th>
              <th className="p-2 text-right">Cijena</th>
            </tr>
          </thead>
          <tbody>
            {basket.rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="p-2">{row.ingredient}</td>
                <td className="p-2">
                  {row.matchedName ? (
                    <>
                      {row.matchedName}
                      {row.packages > 1 && (
                        <span className="ml-1 text-xs text-gray-400">× {row.packages}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-red-500">nije pronađeno</span>
                  )}
                </td>
                <td className="p-2 text-right whitespace-nowrap text-gray-500">
                  {formatQuantity(row.quantity)} {row.unit}
                </td>
                <td className="p-2 text-right whitespace-nowrap font-medium">
                  {row.calculatedPrice !== null
                    ? `${row.exact ? "" : "~"}${row.calculatedPrice.toFixed(2)} €`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-right text-base font-semibold">Ukupno: {basket.total.toFixed(2)} €</p>
      {basket.rows.some((r) => r.calculatedPrice !== null && !r.exact) && (
        <p className="mt-1 text-right text-xs text-gray-400">
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStore("lidl")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            store === "lidl" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Lidl
        </button>
        <button
          type="button"
          onClick={() => setStore("kaufland")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            store === "kaufland" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Kaufland
        </button>
      </div>

      <div className="mt-4">
        <BasketTable basket={store === "lidl" ? lidl : kaufland} />
      </div>
    </div>
  );
}
