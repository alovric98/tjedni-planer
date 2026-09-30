"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/Badge";
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
    return <p className="mt-0.5 text-label text-warn">cijena nedostupna</p>;
  }
  const { purchase } = part;

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-ink-muted">
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
      {part.frozen && (
        <span
          className="inline-flex items-center gap-1 font-semibold text-ink-muted"
          title="Svježeg proizvoda nema u trgovini (ili je u receptu traženo smrznuto) - cijena je za smrznuti."
        >
          <InfoIcon />
          smrznuto
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
 *
 * Hijerarhija: naziv sastojka + cijena su primarni (cijena desno, veća,
 * tabular), "Treba" i detalji pakiranja sekundarni.
 */
function BasketRow({ row }: { row: BasketLineResult }) {
  const chosenPart = row.chosenPartIndex !== null ? row.parts[row.chosenPartIndex] : null;

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-ink [overflow-wrap:anywhere]">{row.ingredient}</p>
          {row.mode === "single" && chosenPart?.matchedName && (
            <p className="mt-0.5 truncate text-label text-ink-muted">{chosenPart.matchedName}</p>
          )}
          {row.mode === "or" && chosenPart && (
            <p className="mt-0.5 text-label text-ink-muted">
              <span className="truncate">{chosenPart.matchedName ?? chosenPart.name}</span>{" "}
              <span>(odabrano - jeftinija alternativa)</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {row.totalPrice !== null ? (
            <p className="text-heading font-semibold tabular-nums text-ink">{row.totalPrice.toFixed(2)} €</p>
          ) : (
            <Badge tone="warn">Cijena nedostupna</Badge>
          )}
          <p className="mt-0.5 text-label text-ink-muted">
            Treba: {formatQuantity(row.quantity)} {row.unit}
          </p>
        </div>
      </div>

      {row.mode === "and" ? (
        <div className="mt-3 space-y-2.5 border-t border-border pt-3">
          {row.parts.map((part, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-label text-ink-muted">{part.matchedName ?? part.name}</span>
                <span className="shrink-0 text-label font-semibold tabular-nums text-ink">
                  {part.itemPrice !== null ? `${part.itemPrice.toFixed(2)} €` : <span className="text-warn">nedostupno</span>}
                </span>
              </div>
              <PartPurchaseLine part={part} />
            </div>
          ))}
          {row.partiallyUnavailable && (
            <p className="text-label text-warn">Dio ovog sastojka nema cijenu - u zbroju je samo ostatak.</p>
          )}
        </div>
      ) : (
        chosenPart && (
          <div className="mt-1">
            <PartPurchaseLine part={chosenPart} />
          </div>
        )
      )}
    </li>
  );
}

function StaleBanner({ label, basket }: { label: string; basket: StoreBasket }) {
  if (!basket.isStale) return null;
  return (
    <div role="status" className="mb-3 rounded-surface border border-warn/30 bg-warn-bg px-4 py-3">
      <p className="text-label font-semibold text-warn">Cijene za {label} nisu ažurirane danas</p>
      <p className="mt-1 text-label text-warn">
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
      <ul className="divide-y divide-border rounded-surface border border-border bg-surface-1 shadow-raised">
        {basket.rows.map((row, i) => (
          <BasketRow key={i} row={row} />
        ))}
      </ul>
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
    <section
      aria-label="Usporedba ukupnih cijena"
      // Iznad mobilnog nav-a (--nav-offset), od `sm` nav je u headeru.
      className="sticky bottom-[calc(var(--nav-offset)+0.75rem)] z-20 mt-4 rounded-surface border border-border-strong bg-surface-1 p-4 shadow-overlay sm:bottom-4"
    >
      <div className={`grid gap-4 ${withData.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {withData.map((s) => (
          <StoreTotalColumn
            key={s.key}
            name={s.label}
            basket={s.basket}
            hasData={s.hasData}
            isCheaper={s.key === cheaperKey}
          />
        ))}
      </div>
      {withData.length === 2 && (
        <p className="mt-3 border-t border-border pt-3 text-center text-label text-ink-muted">
          {bothEmpty
            ? "Nema dovoljno podataka o cijenama za usporedbu."
            : !bothHaveData
              ? `Nema dovoljno podataka za potpunu usporedbu - ${!withData[0].hasData ? withData[0].label : withData[1].label} nema cijenu ni za jedan artikl.`
              : tie
                ? "Cijene su podjednake."
                : `Razlika: ${diff.toFixed(2)} € u korist ${withData.find((s) => s.key === cheaperKey)?.label}`}
        </p>
      )}
    </section>
  );
}

function StoreTotalColumn({
  name,
  basket,
  hasData,
  isCheaper,
}: {
  name: string;
  basket: StoreBasket;
  hasData: boolean;
  isCheaper: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-label font-semibold text-ink-muted">{name}</p>
        {isCheaper && <Badge tone="solid">Jeftinije</Badge>}
      </div>
      {/* Bez ijedne cijene zbroj bi bio "0.00 €" i zavaravao - prikazujemo crticu. */}
      <p className="mt-0.5 text-title font-semibold tabular-nums text-ink">
        {hasData ? `${basket.total.toFixed(2)} €` : <span aria-label="nema cijena">—</span>}
      </p>
      {basket.unpricedCount > 0 && (
        <p className="mt-0.5 text-label text-warn">
          {basket.unpricedCount} {pluralStavki(basket.unpricedCount)} bez cijene
        </p>
      )}
      {basket.isStale && <p className="mt-0.5 text-label text-warn">cijene nisu ažurirane danas</p>}
    </div>
  );
}

export function StoreTabs({ stores }: { stores: StoreEntry[] }) {
  const [activeKey, setActiveKey] = useState<string>(stores[0]?.key ?? "");
  const active = stores.find((s) => s.key === activeKey) ?? stores[0];
  const baseId = useId();
  const tabId = (key: string) => `${baseId}-tab-${key}`;
  const panelId = `${baseId}-panel`;

  // WAI-ARIA tabs: strelice/Home/End mijenjaju karticu i fokus (roving tabindex).
  function onTabKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const index = stores.findIndex((s) => s.key === active?.key);
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % stores.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + stores.length) % stores.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = stores.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActiveKey(stores[next].key);
    document.getElementById(tabId(stores[next].key))?.focus();
  }

  return (
    <div className="mt-4">
      {stores.length > 1 && (
        <div
          role="tablist"
          aria-label="Trgovine"
          onKeyDown={onTabKeyDown}
          className="inline-flex gap-0.5 rounded-control border border-border bg-surface-2 p-0.5"
        >
          {stores.map((s) => {
            const selected = s.key === active.key;
            return (
              <button
                key={s.key}
                id={tabId(s.key)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveKey(s.key)}
                className={`min-h-11 rounded-[0.5rem] px-5 text-label font-semibold transition-[background-color,color,box-shadow] duration-150 ${
                  selected
                    ? "bg-surface-1 text-ink shadow-raised ring-1 ring-border-strong"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <div
          id={panelId}
          role={stores.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={stores.length > 1 ? tabId(active.key) : undefined}
          className="mt-4"
        >
          <BasketView label={active.label} basket={active.basket} />
        </div>
      )}

      <CompareBar stores={stores} />
    </div>
  );
}
