"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { formatQuantity } from "@/lib/format";
import { normalize } from "@/lib/normalize";
import { generateShoppingList, type ShoppingListItem } from "./actions";

// Stanje "kupljeno" za popis za kupovinu (premješteno iz Košarice - vidi
// git log: Košarica je sad isključivo usporedba cijena, ovaj popis je
// jedini pravi checklist, koristi se u dućanu). Isti obrazac perzistencije
// kao prije: localStorage kao "vanjski store" izvan Reacta,
// useSyncExternalStore je hidracijski siguran način čitanja (bez window na
// serveru), za razliku od setState u useEffectu koji bi izazvao dvostruki
// render.
const CHECKED_STORAGE_KEY = "tjedni-planer:popis-checked";
let checkedListeners: Array<() => void> = [];
// Cache u memoriji - i dalje vrijedi izvor istine za ovu sesiju čak i kad
// localStorage.setItem baci grešku (privatni način rada i sl.), pa toggle
// ostaje pouzdan i bez uspješne perzistencije.
let cachedChecked: string | null = null;

function notifyCheckedChanged() {
  for (const listener of checkedListeners) listener();
}

function subscribeChecked(listener: () => void) {
  checkedListeners.push(listener);
  return () => {
    checkedListeners = checkedListeners.filter((l) => l !== listener);
  };
}

function getCheckedSnapshot(): string {
  if (cachedChecked !== null) return cachedChecked;
  try {
    cachedChecked = window.localStorage.getItem(CHECKED_STORAGE_KEY) ?? "[]";
  } catch {
    cachedChecked = "[]";
  }
  return cachedChecked;
}

function getCheckedServerSnapshot(): string {
  return "[]";
}

function useCheckedItems() {
  const raw = useSyncExternalStore(subscribeChecked, getCheckedSnapshot, getCheckedServerSnapshot);
  const checked = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  function toggle(key: string) {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const serialized = JSON.stringify(Array.from(next));
    cachedChecked = serialized;
    try {
      window.localStorage.setItem(CHECKED_STORAGE_KEY, serialized);
    } catch {
      // localStorage nedostupan (privatni način rada i sl.) - stanje ostaje u memoriji (cachedChecked) za ovu sesiju
    }
    notifyCheckedChanged();
  }

  return { checked, toggle };
}

/**
 * Jedan redak - namjerno velik i čitljiv (koristi se dok korisnik hoda po
 * dućanu s košarom, često na lošem svjetlu). BEZ cijena - ovo je čist
 * checklist, cijene su na Košarici. Tap bilo gdje na retku pali "kupljeno":
 * checkbox se puni accent-zelenom, naziv dobiva line-through, cijeli redak
 * pada na opacity 0.45. Redak NE nestaje i NE kolabira - samo mijenja
 * stanje, ostaje na mjestu da se lako odznači (dizajn-direkcija: mijenja se
 * stanje, ne struktura).
 */
function ShoppingListRow({
  item,
  isChecked,
  onToggle,
}: {
  item: ShoppingListItem;
  isChecked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3.5 transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isChecked ? "opacity-[0.45]" : "opacity-100"
      }`}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        className="sr-only"
        aria-label={`Označi "${item.name}" kao kupljeno`}
      />
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200 ${
          isChecked ? "border-accent bg-accent" : "border-border bg-surface-1"
        }`}
      >
        {isChecked && (
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span
        className={`text-lg font-semibold text-ink transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isChecked ? "line-through" : ""
        }`}
      >
        {item.name} — {formatQuantity(item.quantity)} {item.unit}
      </span>
    </label>
  );
}

export function ShoppingListGenerator() {
  const [items, setItems] = useState<ShoppingListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { checked, toggle } = useCheckedItems();

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

      {error && <p className="mt-2 text-sm text-warn">{error}</p>}

      {items && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-ink-muted">Popis za kupovinu</h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Nema odabranih recepata za tjedan.</p>
          ) : (
            <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface-1">
              {items.map((item, i) => {
                // Isti ključ kao u generateShoppingList (actions.ts) - naziv
                // + jedinica - da dvije stavke istog naziva ali različite
                // jedinice (npr. "mlijeko" u l i "mlijeko" u kom) ne dijele
                // slučajno isti checkbox.
                const key = `${normalize(item.name)}|${item.unit}`;
                return <ShoppingListRow key={i} item={item} isChecked={checked.has(key)} onToggle={() => toggle(key)} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
