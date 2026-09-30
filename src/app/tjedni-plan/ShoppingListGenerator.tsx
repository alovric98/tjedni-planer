"use client";

import { useEffect, useState, useTransition } from "react";
import { formatQuantity } from "@/lib/format";
import {
  getActiveList,
  getArchivedLists,
  regenerateActiveList,
  toggleListItem,
  type PersistedList,
} from "./list-actions";

/**
 * Popis za kupovinu - trajno spremljen u Supabase po korisniku (prije je
 * "kupljeno" stanje živjelo u localStorageu po uređaju, vidi git log).
 * Aktivan popis se učitava pri otvaranju stranice i preživljava zatvaranje
 * aplikacije, promjenu uređaja i odlazak na drugi tab. Redak NE nestaje i
 * NE kolabira kad se označi - samo mijenja stanje, ostaje na mjestu da se
 * lako odznači (dizajn-direkcija: mijenja se stanje, ne struktura). CIJELI
 * popis nestaje iz aktivnog prikaza tek kad su SVE stavke označene - tada
 * pada u "Prijašnje liste" ispod.
 */
function ShoppingListRow({
  item,
  isChecked,
  isPending,
  onToggle,
}: {
  item: { name: string; quantity: number; unit: string };
  isChecked: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3.5 transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isChecked ? "opacity-[0.45]" : "opacity-100"
      } ${isPending ? "pointer-events-none" : ""}`}
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

function ArchivedListCard({ list }: { list: PersistedList }) {
  const [open, setOpen] = useState(false);
  const date = list.archivedAt
    ? new Date(list.archivedAt).toLocaleDateString("hr-HR", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="rounded-xl border border-border bg-surface-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold text-ink-muted">
          Dovršeno {date} · {list.items.length} {pluralStavki(list.items.length)}
        </span>
        <span className="text-xs font-semibold text-ink-muted">{open ? "Sakrij" : "Prikaži"}</span>
      </button>
      {open && (
        <div className="divide-y divide-border border-t border-border">
          {list.items.map((item) => (
            <div key={item.id} className="flex min-h-12 items-center gap-3 px-4 py-3.5 opacity-[0.45]">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent bg-accent"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-lg font-semibold text-ink line-through">
                {item.name} — {formatQuantity(item.quantity)} {item.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ShoppingListGenerator() {
  const [activeList, setActiveList] = useState<PersistedList | null | undefined>(undefined);
  const [archivedLists, setArchivedLists] = useState<PersistedList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();

  useEffect(() => {
    Promise.all([getActiveList(), getArchivedLists()])
      .then(([active, archived]) => {
        setActiveList(active);
        setArchivedLists(archived);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Greška kod učitavanja popisa."));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleGenerate() {
    setError(null);
    startGenerating(async () => {
      try {
        const list = await regenerateActiveList();
        setActiveList(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Greška kod generiranja popisa.");
      }
    });
  }

  async function handleToggle(itemId: string) {
    setPendingItemId(itemId);
    // Optimistično - redak se odmah vizualno mijenja, prije nego server
    // potvrdi (isto ponašanje kao stari localStorage toggle).
    setActiveList((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)),
      };
    });

    try {
      const result = await toggleListItem(itemId);
      setActiveList(result.list);
      if (result.archived) {
        const [freshArchived] = await Promise.all([getArchivedLists()]);
        setArchivedLists(freshArchived);
      }
      if (result.prunedOld) {
        setToast("Stara lista je automatski uklonjena.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška kod spremanja.");
      const [active, archived] = await Promise.all([getActiveList(), getArchivedLists()]);
      setActiveList(active);
      setArchivedLists(archived);
    } finally {
      setPendingItemId(null);
    }
  }

  const isLoading = activeList === undefined;

  return (
    <div>
      <button
        type="button"
        disabled={isGenerating}
        onClick={handleGenerate}
        className="rounded-full bg-brand-dark px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isGenerating ? "Generiram…" : activeList ? "Ponovno generiraj popis" : "Generiraj popis za kupovinu"}
      </button>

      {error && <p className="mt-2 text-sm text-warn">{error}</p>}

      {!isLoading && activeList && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-ink-muted">Popis za kupovinu</h2>
          {activeList.items.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Nema odabranih recepata za tjedan.</p>
          ) : (
            <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface-1">
              {activeList.items.map((item) => (
                <ShoppingListRow
                  key={item.id}
                  item={item}
                  isChecked={item.checked}
                  isPending={pendingItemId === item.id}
                  onToggle={() => handleToggle(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {archivedLists.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-ink-muted">Prijašnje liste</h2>
          <div className="mt-2 space-y-2">
            {archivedLists.map((list) => (
              <ArchivedListCard key={list.id} list={list} />
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-40 rounded-xl border border-border bg-surface-1 px-4 py-3 text-center text-sm font-semibold text-ink shadow-[0_-2px_12px_rgba(27,36,32,0.10)] sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:w-auto sm:-translate-x-1/2">
          {toast}
        </div>
      )}
    </div>
  );
}
