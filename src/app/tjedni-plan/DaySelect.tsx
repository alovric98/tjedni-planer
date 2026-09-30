"use client";

import { useState, useTransition } from "react";
import { setDayRecipe } from "./actions";
import { showToast } from "@/components/Toast";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Button";
import { RecipePicker } from "@/components/ui/RecipePicker";

type DaySelectProps = {
  dayOfWeek: number;
  /** "Ponedjeljak" - puni naziv, za pristupačnost. */
  label: string;
  /** "Pon" */
  shortLabel: string;
  dayOfMonth: number;
  isToday: boolean;
  selectedRecipeId: string | null;
  recipes: { id: string; name: string }[];
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true">
      <path d="m4 6.5 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DaySelect({
  dayOfWeek,
  label,
  shortLabel,
  dayOfMonth,
  isToday,
  selectedRecipeId,
  recipes,
}: DaySelectProps) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(selectedRecipeId);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ next: string | null; previous: string | null } | null>(null);
  // Povećava se kad korisnik odabere recept - služi kao `key` da se naziv
  // animira samo nakon odabira, ne pri prvom renderu stranice.
  const [changeCount, setChangeCount] = useState(0);

  // Server je izvor istine: nakon revalidacije stranice uskladi lokalni
  // (optimistični) odabir s onim što je stvarno spremljeno.
  const [prevProp, setPrevProp] = useState(selectedRecipeId);
  if (selectedRecipeId !== prevProp) {
    setPrevProp(selectedRecipeId);
    setValue(selectedRecipeId);
  }

  const selectedName = recipes.find((r) => r.id === value)?.name ?? null;
  const hasRecipe = value !== null && selectedName !== null;

  function save(next: string | null, previous: string | null) {
    setError(null);
    setFailed(null);
    startTransition(async () => {
      try {
        await setDayRecipe(dayOfWeek, next);
        showToast(next ? "Dodano u tjedni plan." : "Uklonjeno iz tjednog plana.");
      } catch (e) {
        // Vrati prikaz na zadnje spremljeno stanje i ponudi ponovni pokušaj.
        setValue(previous);
        setError(e instanceof Error ? e.message : "Greška kod spremanja.");
        setFailed({ next, previous });
      }
    });
  }

  function handleChange(next: string | null) {
    setValue(next);
    setChangeCount((c) => c + 1);
    save(next, value);
  }

  function retry() {
    if (!failed) return;
    setValue(failed.next);
    save(failed.next, failed.previous);
  }

  const triggerState = error
    ? "border-warn bg-warn-bg/40"
    : hasRecipe
      ? `border-transparent ${isToday ? "bg-accent-soft hover:bg-accent-soft/70" : "bg-surface-2 hover:bg-surface-3"}`
      : `border-dashed border-border-strong text-ink-muted hover:border-accent hover:bg-surface-2 hover:text-ink`;

  return (
    <li
      className={`relative flex gap-3 px-3 py-3 first:rounded-t-surface last:rounded-b-surface sm:gap-4 sm:px-4 ${
        isToday ? "bg-accent-soft/40" : ""
      }`}
    >
      {isToday && (
        <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-accent" />
      )}

      <div className="flex w-11 shrink-0 flex-col items-center justify-center pl-0.5 text-center sm:w-14">
        <span className="sr-only">
          {label}, {dayOfMonth}.{isToday ? " (danas)" : ""}
        </span>
        <span
          aria-hidden="true"
          className={`text-micro font-semibold uppercase ${isToday ? "text-accent-fg" : "text-ink-muted"}`}
        >
          {shortLabel}
        </span>
        <span
          aria-hidden="true"
          className={`font-display text-[1.625rem] leading-none tabular-nums ${isToday ? "text-accent-fg" : "text-ink"}`}
        >
          {dayOfMonth}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <RecipePicker
          value={value}
          options={recipes.map((r) => ({ value: r.id, label: r.name }))}
          onChange={handleChange}
          label={`Recepti za ${label.toLocaleLowerCase("hr")}`}
          sheetTitle={`${label} — odaberi recept`}
          clearLabel="Ukloni recept"
          busy={isPending}
          triggerClassName={`flex min-h-14 w-full items-center justify-between gap-3 rounded-control border px-3.5 py-2 text-left transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.99] aria-expanded:border-accent aria-expanded:ring-[3px] aria-expanded:ring-accent/20 aria-busy:cursor-progress ${triggerState}`}
        >
          <span className="sr-only">Recept za {label.toLocaleLowerCase("hr")}: </span>
          {hasRecipe ? (
            <span key={changeCount} className={`min-w-0 ${changeCount > 0 ? "animate-pop-in" : ""}`}>
              {isToday && (
                <span className="mb-0.5 block">
                  <Badge tone="accent">Danas</Badge>
                </span>
              )}
              <span className="block truncate text-heading font-medium text-ink">{selectedName}</span>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2 text-[0.9375rem] font-medium">
              <PlusIcon />
              <span className="truncate">
                {isToday ? "Što je za ručak danas?" : "Odaberi recept"}
              </span>
            </span>
          )}
          {isPending ? <Spinner className="text-ink-muted" /> : <ChevronIcon />}
        </RecipePicker>

        {error && (
          <p role="alert" className="mt-1.5 flex flex-wrap items-center gap-x-3 px-1 text-label font-semibold text-warn">
            <span>{error}</span>
            {failed && (
              <button
                type="button"
                onClick={retry}
                className="min-h-8 rounded-control px-1 underline underline-offset-2 hover:text-ink"
              >
                Pokušaj ponovno
              </button>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
