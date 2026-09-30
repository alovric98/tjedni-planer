"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { formatQuantity } from "@/lib/format";
import { showToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
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
    <li>
      <label
        className={`group flex min-h-14 cursor-pointer items-center gap-3.5 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/60 ${
          isPending ? "pointer-events-none" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggle}
          className="peer sr-only"
          aria-label={`Označi "${item.name}" kao kupljeno`}
        />
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.4375rem] border-[1.5px] transition-[background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:scale-90 peer-focus-visible:ring-[3px] peer-focus-visible:ring-accent/40 ${
            isChecked
              ? "border-accent bg-accent text-white"
              : "border-border-strong bg-surface-1 group-hover:border-accent"
          }`}
        >
          {isChecked && <CheckIcon draw />}
        </span>
        <span
          className={`min-w-0 flex-1 text-heading line-through decoration-1 transition-[color,text-decoration-color] duration-200 ${
            isChecked
              ? "font-normal text-ink-muted decoration-ink-muted"
              : "font-medium text-ink decoration-transparent"
          }`}
        >
          {item.name}
        </span>
        <span
          className={`shrink-0 text-label tabular-nums transition-colors duration-200 ${
            isChecked ? "text-ink-muted" : "font-semibold text-ink-muted"
          }`}
        >
          {formatQuantity(item.quantity)} {item.unit}
        </span>
      </label>
    </li>
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
  const panelId = useId();
  const date = list.archivedAt
    ? new Date(list.archivedAt).toLocaleDateString("hr-HR", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="rounded-surface border border-border bg-surface-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="group flex min-h-14 w-full items-center justify-between gap-3 rounded-surface px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2/60 active:bg-surface-2"
      >
        <span className="min-w-0">
          <span className="block text-label font-semibold text-ink">{date}</span>
          <span className="block text-label text-ink-muted">
            {list.items.length} {pluralStavki(list.items.length)} · dovršeno
          </span>
        </span>
        <ChevronDownIcon
          className={`text-ink-subtle transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>
      {/* Animating grid-rows 0fr→1fr gives a height transition without measuring; `inert` hides the closed content from screen readers. */}
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <ul className="min-h-0 divide-y divide-border overflow-hidden">
          {list.items.map((item, i) => (
            <li
              key={item.id}
              className={`flex min-h-12 items-center gap-3 px-4 py-2.5 ${i === 0 ? "border-t border-border" : ""}`}
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-fg"
              >
                <CheckIcon className="scale-[0.8]" />
              </span>
              <span className="min-w-0 flex-1 text-label text-ink-muted">{item.name}</span>
              <span className="shrink-0 text-label tabular-nums text-ink-muted">
                {formatQuantity(item.quantity)} {item.unit}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Učitavam popis"
      className="mt-3 divide-y divide-border rounded-surface border border-border bg-surface-1"
    >
      {[70, 52, 62, 44].map((w) => (
        <div key={w} className="flex min-h-14 animate-pulse items-center gap-3.5 px-4">
          <span className="h-6 w-6 shrink-0 rounded-[0.4375rem] bg-surface-2" />
          <span className="h-3.5 rounded bg-surface-2" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

export function ShoppingListGenerator() {
  const [activeList, setActiveList] = useState<PersistedList | null | undefined>(undefined);
  const [archivedLists, setArchivedLists] = useState<PersistedList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [isGenerating, startGenerating] = useTransition();

  useEffect(() => {
    Promise.all([getActiveList(), getArchivedLists()])
      .then(([active, archived]) => {
        setActiveList(active);
        setArchivedLists(archived);
      })
      .catch((e) => {
        setActiveList(null);
        setError(e instanceof Error ? e.message : "Greška kod učitavanja popisa.");
      });
  }, []);

  function handleGenerate() {
    setError(null);
    startGenerating(async () => {
      try {
        const list = await regenerateActiveList();
        setActiveList(list);
        // Only drop the "all bought" card once a new list actually exists.
        setJustCompleted(false);
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
        setJustCompleted(true);
        const [freshArchived] = await Promise.all([getArchivedLists()]);
        setArchivedLists(freshArchived);
      }
      if (result.prunedOld) {
        showToast("Stara lista je automatski uklonjena.");
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
  const items = activeList?.items ?? [];
  const checkedCount = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  return (
    <section aria-labelledby="shopping-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="shopping-heading" className="text-heading font-semibold text-ink">
          Popis za kupovinu
        </h2>
        {activeList && (
          <Button variant="secondary" loading={isGenerating} onClick={handleGenerate}>
            {isGenerating ? "Generiram…" : "Ponovno generiraj"}
          </Button>
        )}
      </div>

      {/* Live region is always mounted so screen readers announce the text when it appears. */}
      <div role="status" className="sr-only">
        {justCompleted && !activeList ? "Sve je kupljeno. Popis je spremljen među prijašnje liste." : ""}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-surface border border-warn/30 bg-warn-bg px-4 py-3 text-label font-medium text-warn"
        >
          {error}
        </p>
      )}

      {isLoading && !error && <ListSkeleton />}

      {/* Nema aktivnog popisa: poziv na akciju. */}
      {!isLoading && !activeList && !justCompleted && (
        <div className="mt-3 rounded-surface border border-dashed border-border-strong px-4 py-5">
          <p className="text-label text-ink-muted">
            Sastavi popis iz recepata koje si odabrao/la za ovaj tjedan. Iste sastojke zbrojimo u jednu stavku.
          </p>
          <Button className="mt-4" size="lg" fullWidth loading={isGenerating} onClick={handleGenerate}>
            {isGenerating ? "Generiram…" : "Generiraj popis za kupovinu"}
          </Button>
        </div>
      )}

      {/* Sve stavke označene: popis je upravo arhiviran. */}
      {!isLoading && !activeList && justCompleted && (
        <div className="animate-pop-in mt-3 rounded-surface border border-accent/30 bg-accent-soft px-4 py-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
              <CheckIcon draw />
            </span>
            <div>
              <p className="text-heading font-semibold text-ink">
                Sve je kupljeno
              </p>
              <p className="mt-0.5 text-label text-ink-muted">Popis je spremljen među prijašnje liste.</p>
            </div>
          </div>
          <Button className="mt-4" variant="secondary" fullWidth loading={isGenerating} onClick={handleGenerate}>
            {isGenerating ? "Generiram…" : "Generiraj novi popis"}
          </Button>
        </div>
      )}

      {!isLoading && activeList && (
        <div className="mt-3 overflow-hidden rounded-surface border border-border bg-surface-1 shadow-raised">
          {items.length === 0 ? (
            <p className="px-4 py-5 text-label text-ink-muted">
              Nema odabranih recepata za tjedan. Odaberi recepte u planu i ponovno generiraj popis.
            </p>
          ) : (
            <>
              <div className="border-b border-border px-4 py-3">
                <p aria-live="polite" className="flex items-baseline justify-between text-label text-ink-muted">
                  <span>
                    Kupljeno{" "}
                    <span className="font-semibold tabular-nums text-ink">
                      {checkedCount} od {items.length}
                    </span>
                  </span>
                  <span className="tabular-nums">{progress}%</span>
                </p>
                <div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <ul className="divide-y divide-border lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
                {items.map((item) => (
                  <ShoppingListRow
                    key={item.id}
                    item={item}
                    isChecked={item.checked}
                    isPending={pendingItemId === item.id}
                    onToggle={() => handleToggle(item.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {archivedLists.length > 0 && (
        <div className="mt-8">
          <h2 className="text-label font-semibold text-ink-muted">Prijašnje liste</h2>
          <div className="mt-2 space-y-2">
            {archivedLists.map((list) => (
              <ArchivedListCard key={list.id} list={list} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
