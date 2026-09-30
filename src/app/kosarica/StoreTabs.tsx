"use client";

import { useState } from "react";
import { formatQuantity, formatMeasure } from "@/lib/format";
import type { BasketLineResult, PartPriceResult } from "@/lib/pricing";
import type { StoreKey } from "@/config/store-options";

export type StoreBasket = {
  rows: BasketLineResult[];
  total: number;
  unpricedCount: number;
  lastUpdated: string | null;
  isStale: boolean;
};

export type StoreEntry = {
  key: StoreKey;
  label: string;
  basket: StoreBasket;
};

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

/** "Kupuješ" (cijela pakiranja ili na vagu) + oznake prosjeka/procjene. */
function PartPurchaseLine({ part }: { part: PartPriceResult }) {
  if (part.itemPrice === null || !part.purchase) {
    return <p className="text-xs text-warn">cijena nedostupna</p>;
  }
  const { purchase } = part;

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
      {purchase.soldByWeight ? (
        <span>
          Na vagu: {formatMeasure(purchase.purchaseQuantity, purchase.basis)} × {purchase.pricePerKg?.toFixed(2)} €/kg
        </span>
      ) : (
        <span>
          Kupuješ: {purchase.packCount}× {formatMeasure(purchase.packSize ?? 0, purchase.basis)}
          {purchase.surplus > 0.0005 && <> · višak {formatMeasure(purchase.surplus, purchase.basis)}</>}
        </span>
      )}
      {part.averagedCount > 1 && (
        <span
          className="inline-flex items-center gap-1 font-semibold text-ink-muted"
          title={`Prosjek ${part.averagedCount} varijanti istog proizvoda (npr. file, s kosti, s kožom)`}
        >
          <InfoIcon />
          prosjek {part.averagedCount} varijanti
        </span>
      )}
      {part.estimated && (
        <span
          className="inline-flex items-center gap-1 font-semibold text-ink-muted"
          title="Za ovaj sastojak nema ručno definiranog pravila - proizvod je odabran generičkim uparivanjem pa cijena može odstupati."
        >
          <InfoIcon />
          procjena
        </span>
      )}
    </p>
  );
}

/**
 * Jedan redak popisa - Košarica je isključivo za usporedbu cijena
 * (read-only), tap-to-strike checklist interakcija živi na "Tjedni plan"
 * ekranu (ShoppingListGenerator.tsx), gdje se koristi u dućanu.
 */
function BasketRow({ row }: { row: BasketLineResult }) {
  const chosenPart = row.chosenPartIndex !== null ? row.parts[row.chosenPartIndex] : null;

  return (
    <div className="flex min-h-12 items-start gap-3 py-4">
      <div className="min-w-0 flex-1">
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
                  <span className="text-xs text-ink-muted">{part.matchedName ?? part.name}</span>
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
    </div>
  );
}

function StaleBanner({ label, basket }: { label: string; basket: StoreBasket }) {
  if (!basket.isStale) return null;
  return (
    <div className="mb-3 rounded-xl border border-warn/30 bg-warn-bg p-4">
      <p className="text-sm font-semibold text-warn">Cijene za {label} nisu ažurirane danas</p>
      <p className="mt-1 text-xs text-warn">
        Zadnji uspješan dohvat: {formatDate(basket.lastUpdated)}. Prikazane cijene mogu biti stare i ne odražavati
        stanje u trgovini.
      </p>
    </div>
  );
}

function BasketView({ label, basket }: { label: string; basket: StoreBasket }) {
  return (
    <div>
      <StaleBanner label={label} basket={basket} />
      <div className="divide-y divide-border">
        {basket.rows.map((row, i) => (
          <BasketRow key={i} row={row} />
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
 *
 * "Jeftinije" usporedba ima smisla samo kad su TOČNO dvije trgovine
 * odabrane (današnji realan slučaj - Lidl+Kaufland) - s jednom trgovinom
 * nema s čim usporediti, a s 3+ (buduće trgovine) parna "jeftinije" oznaka
 * gubi značenje pa se prikazuju samo ukupni iznosi bez badgea.
 */
function CompareBar({ stores }: { stores: StoreEntry[] }) {
  const withData = stores.map((s) => ({ ...s, hasData: s.basket.unpricedCount < s.basket.rows.length }));
  const bothHaveData = withData.length === 2 && withData.every((s) => s.hasData);

  let cheaperKey: string | null = null;
  let tie = false;
  let diff = 0;
  if (bothHaveData) {
    const [a, b] = withData;
    tie = a.basket.total === b.basket.total;
    if (!tie) cheaperKey = a.basket.total < b.basket.total ? a.key : b.key;
    diff = Math.abs(a.basket.total - b.basket.total);
  }

  const bothEmpty = withData.length === 2 && withData.every((s) => !s.hasData);

  return (
    <div className="sticky bottom-24 z-20 mt-4 rounded-2xl border border-border bg-surface-1 p-4 shadow-[0_-2px_12px_rgba(27,36,32,0.10)] sm:bottom-4">
      <div className={`grid gap-3 ${withData.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {withData.map((s) => (
          <StoreTotalColumn key={s.key} name={s.label} basket={s.basket} isCheaper={s.key === cheaperKey} />
        ))}
      </div>
      {withData.length === 2 && (
        <p className="mt-2 text-center text-xs text-ink-muted">
          {bothEmpty
            ? "Nema dovoljno podataka o cijenama za usporedbu."
            : !bothHaveData
              ? `Nema dovoljno podataka za potpunu usporedbu - ${!withData[0].hasData ? withData[0].label : withData[1].label} nema cijenu ni za jedan artikl.`
              : tie
                ? "Cijene su podjednake."
                : `Razlika: ${diff.toFixed(2)} € u korist ${withData.find((s) => s.key === cheaperKey)?.label}`}
        </p>
      )}
    </div>
  );
}

function StoreTotalColumn({ name, basket, isCheaper }: { name: string; basket: StoreBasket; isCheaper: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-ink-muted">{name}</p>
        {isCheaper && (
          <span className="rounded-lg bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
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

export function StoreTabs({ stores }: { stores: StoreEntry[] }) {
  const [activeKey, setActiveKey] = useState<string>(stores[0]?.key ?? "");
  const active = stores.find((s) => s.key === activeKey) ?? stores[0];

  return (
    <div className="mt-4">
      {stores.length > 1 && (
        <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
          {stores.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveKey(s.key)}
              className={`min-h-12 rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-200 ${
                s.key === active.key ? "bg-accent text-white" : "text-ink-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="mt-4">
          <BasketView label={active.label} basket={active.basket} />
        </div>
      )}

      <CompareBar stores={stores} />
    </div>
  );
}
