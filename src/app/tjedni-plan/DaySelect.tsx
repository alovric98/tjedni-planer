"use client";

import { useState, useTransition } from "react";
import { setDayRecipe } from "./actions";
import { showToast } from "@/components/Toast";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Button";
import { ChevronDownIcon, PlusIcon } from "@/components/ui/icons";
import { RecipePicker } from "@/components/ui/RecipePicker";

type DaySelectProps = {
  dayOfWeek: number;
  /** Full day name ("Ponedjeljak"), used for accessibility labels. */
  label: string;
  /** "Pon" */
  shortLabel: string;
  dayOfMonth: number;
  isToday: boolean;
  selectedRecipeId: string | null;
  recipes: { id: string; name: string }[];
};

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
  // Incremented on every user selection - used as `key` so the name animates
  // only after a selection, not on the first page render.
  const [changeCount, setChangeCount] = useState(0);

  // The server is the source of truth: after the page revalidates, sync the
  // local (optimistic) selection with what was actually saved. A changed
  // server value also invalidates any earlier error/retry for this day.
  const [prevProp, setPrevProp] = useState(selectedRecipeId);
  if (selectedRecipeId !== prevProp) {
    setPrevProp(selectedRecipeId);
    setValue(selectedRecipeId);
    setError(null);
    setFailed(null);
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
        // Roll the display back to the last saved state and offer a retry.
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
          {isPending ? <Spinner className="text-ink-muted" /> : <ChevronDownIcon className="text-ink-subtle" />}
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
