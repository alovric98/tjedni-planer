"use client";

import { useState } from "react";
import { formatQuantity, formatBasisQuantity } from "@/lib/format";
import type { BasketLineResult, PartPriceResult } from "@/lib/pricing";

export type StoreBasket = {
  rows: BasketLineResult[];
  total: number;
  unpricedCount: number;
  lastUpdated: string | null;
  isStale: boolean;
};

const STORE_LABEL = { lidl: "Lidl", kaufland: "Kaufland" } as const;

function formatDate(iso: string | null): string {
  if (!iso) return "nikad";
  return new Date(iso).toLocaleString("hr-HR", { dateStyle: "medium", timeStyle: "short" });
}

// "1 stavka / 2 stavke / 5 stavki" - standardna slavenska pluralizacija
// (11-14 uvijek "stavki", inače po zadnjoj znamenki).
function pluralStavki(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "stavki";
  if (mod10 === 1) return "stavka";
  if (mod10 >= 2 && mod10 <= 4) return "stavke";
  return "stavki";
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9 9a1 1 0 0 0 0 2h.25v3H9a1 1 0 1 0 0 2h2.5a1 1 0 1 0 0-2h-.25V10a1 1 0 0 0-1-1H9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** "Treba / Kupuješ" + oznaka "prosjek N proizvoda" (FIX 1 + FIX 2 u UI-u). */
function PartPurchaseLine({ part }: { part: PartPriceResult }) {
  if (part.itemPrice === null || !part.purchase) {
    return <p className="text-xs text-warn">cijena nedostupna</p>;
  }
  const { purchase, averagePrice } = part;
  const rangeLabel =
    averagePrice.min !== null && averagePrice.max !== null
      ? `${averagePrice.min.toFixed(2)}–${averagePrice.max.toFixed(2)} €/${purchase.basis}`
      : "";
  const trimmedLabel =
    averagePrice.trimmedOutCount > 0
      ? `, ${averagePrice.trimmedOutCount} ${averagePrice.trimmedOutCount === 1 ? "ekstrem izbačen" : "ekstrema izbačeno"} iz prosjeka`
      : "";

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
      <span>Kupuješ: {formatBasisQuantity(purchase.purchaseQuantity, purchase.basis)}</span>
      {purchase.packageSizeAssumed && (
        <span
          className="text-ink-muted/80"
          title="Cjenik ne daje veličinu pakiranja za ovaj proizvod - koristi se pretpostavljena standardna veličina."
        >
          · pretpostavljeno pakiranje
        </span>
      )}
      {averagePrice.usedAverage && (
        <span
          className="inline-flex items-center gap-1 font-medium text-accent"
          title={`Prosjek ${averagePrice.pricedCount} proizvoda (${rangeLabel}${trimmedLabel})`}
        >
          <InfoIcon />
          prosjek {averagePrice.pricedCount} proizvoda
        </span>
      )}
    </p>
  );
}

function BasketRowCard({ row }: { row: BasketLineResult }) {
  const chosenPart = row.chosenPartIndex !== null ? row.parts[row.chosenPartIndex] : null;

  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{row.ingredient}</p>
          {row.mode === "single" && chosenPart?.matchedName && (
            <p className="mt-0.5 truncate text-sm text-ink-muted">{chosenPart.matchedName}</p>
          )}
          {row.mode === "or" && chosenPart && (
            <p className="mt-0.5 truncate text-sm text-ink-muted">
              {chosenPart.matchedName ?? chosenPart.name}{" "}
              <span className="text-xs">(odabrano - jeftinija alternativa)</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink-muted">
            Treba: {formatQuantity(row.quantity)} {row.unit}
          </p>
          <p className="font-semibold tabular-nums text-ink">
            {row.totalPrice !== null ? `${row.totalPrice.toFixed(2)} €` : <span className="text-warn">cijena nedostupna</span>}
          </p>
        </div>
      </div>

      {row.mode === "and" ? (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {row.parts.map((part, i) => (
            <div key={i}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-muted">{part.matchedName ?? part.name}</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-ink">
                  {part.itemPrice !== null ? `${part.itemPrice.toFixed(2)} €` : <span className="text-warn">nedostupno</span>}
                </span>
              </div>
              <PartPurchaseLine part={part} />
            </div>
          ))}
          {row.partiallyUnavailable && (
            <p className="text-xs text-warn">Dio ovog sastojka nema cijenu - u zbroju je samo ostatak.</p>
          )}
        </div>
      ) : (
        chosenPart && <PartPurchaseLine part={chosenPart} />
      )}
    </div>
  );
}

function StaleBanner({ store, basket }: { store: keyof typeof STORE_LABEL; basket: StoreBasket }) {
  if (!basket.isStale) return null;
  return (
    <div className="mb-3 rounded-2xl border border-warn/30 bg-warn-bg p-4">
      <p className="text-sm font-semibold text-warn">
        Cijene za {STORE_LABEL[store]} nisu ažurirane danas
      </p>
      <p className="mt-1 text-xs text-warn">
        Zadnji uspješan dohvat: {formatDate(basket.lastUpdated)}. Prikazane cijene mogu biti stare i ne odražavati
        stanje u trgovini.
      </p>
    </div>
  );
}

function BasketView({ store, basket }: { store: keyof typeof STORE_LABEL; basket: StoreBasket }) {
  return (
    <div>
      <StaleBanner store={store} basket={basket} />
      <div className="space-y-2">
        {basket.rows.map((row, i) => (
          <BasketRowCard key={i} row={row} />
        ))}
      </div>
    </div>
  );
}

/**
 * Distinktivni potez iz dizajn-direkcije: usporedba ukupne cijene po
 * trgovini prikovana za dno ekrana (thumb zone), vidljiva dok korisnik
 * scrolla popis. Ogromne tabular brojke, zelena "Jeftinije" oznaka na
 * povoljnijoj trgovini - jedina stvar na ekranu dizajnirana da se pročita
 * bez fokusiranja pogleda, dok korisnik drži košaru u dućanu.
 */
function CompareBar({ lidl, kaufland }: { lidl: StoreBasket; kaufland: StoreBasket }) {
  const lidlHasData = lidl.unpricedCount < lidl.rows.length;
  const kauflandHasData = kaufland.unpricedCount < kaufland.rows.length;
  const bothEmpty = !lidlHasData && !kauflandHasData;
  const tie = !bothEmpty && lidl.total === kaufland.total;
  const lidlCheaper = !bothEmpty && !tie && lidl.total < kaufland.total;
  const kauflandCheaper = !bothEmpty && !tie && kaufland.total < lidl.total;
  const diff = Math.abs(lidl.total - kaufland.total);

  return (
    <div className="sticky bottom-20 z-20 mt-4 rounded-2xl border border-border bg-surface-1 p-4 shadow-lg shadow-black/10 sm:bottom-4">
      <div className="grid grid-cols-2 gap-3">
        <StoreTotalColumn name="Lidl" basket={lidl} isCheaper={lidlCheaper} />
        <StoreTotalColumn name="Kaufland" basket={kaufland} isCheaper={kauflandCheaper} />
      </div>
      <p className="mt-2 text-center text-xs text-ink-muted">
        {bothEmpty
          ? "Nema dovoljno podataka o cijenama za usporedbu."
          : tie
            ? "Cijene su podjednake."
            : `Razlika: ${diff.toFixed(2)} € u korist ${lidlCheaper ? "Lidla" : "Kauflanda"}`}
      </p>
    </div>
  );
}

function StoreTotalColumn({ name, basket, isCheaper }: { name: string; basket: StoreBasket; isCheaper: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-ink-muted">{name}</p>
        {isCheaper && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
            Jeftinije
          </span>
        )}
      </div>
      <p className="text-3xl font-semibold tabular-nums text-ink">{basket.total.toFixed(2)} €</p>
      {basket.unpricedCount > 0 && (
        <p className="text-xs text-warn">
          {basket.unpricedCount} {pluralStavki(basket.unpricedCount)} bez cijene
        </p>
      )}
      {basket.isStale && <p className="text-xs text-warn">cijene nisu ažurirane danas</p>}
    </div>
  );
}

export function StoreTabs({ lidl, kaufland }: { lidl: StoreBasket; kaufland: StoreBasket }) {
  const [store, setStore] = useState<"lidl" | "kaufland">("lidl");

  return (
    <div className="mt-4">
      <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setStore("lidl")}
          className={`min-h-12 rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-200 ${
            store === "lidl" ? "bg-accent text-white" : "text-ink-muted"
          }`}
        >
          Lidl
        </button>
        <button
          type="button"
          onClick={() => setStore("kaufland")}
          className={`min-h-12 rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-200 ${
            store === "kaufland" ? "bg-accent text-white" : "text-ink-muted"
          }`}
        >
          Kaufland
        </button>
      </div>

      <div className="mt-4">
        <BasketView store={store} basket={store === "lidl" ? lidl : kaufland} />
      </div>

      <CompareBar lidl={lidl} kaufland={kaufland} />
    </div>
  );
}
