"use client";

import { useState, useTransition } from "react";
import { setDayRecipe } from "./actions";
import { showToast } from "@/components/Toast";

type DaySelectProps = {
  dayOfWeek: number;
  label: string;
  selectedRecipeId: string | null;
  recipes: { id: string; name: string }[];
};

export function DaySelect({ dayOfWeek, label, selectedRecipeId, recipes }: DaySelectProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasRecipe = selectedRecipeId !== null;

  function handleChange(value: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await setDayRecipe(dayOfWeek, value);
        showToast(value ? "Dodano u tjedni plan." : "Uklonjeno iz tjednog plana.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Greška kod spremanja.");
      }
    });
  }

  return (
    <div>
      <div
        className={`flex items-center gap-3 rounded-xl p-3 transition-colors duration-200 ${
          hasRecipe ? "bg-surface-2" : "bg-surface-1"
        }`}
      >
        <span
          className={`w-[4.5rem] shrink-0 text-sm font-semibold ${
            hasRecipe ? "text-accent-fg" : "text-ink"
          }`}
        >
          {label}
        </span>
        <select
          defaultValue={selectedRecipeId ?? ""}
          disabled={isPending}
          onChange={(e) => handleChange(e.target.value || null)}
          className={`min-w-0 flex-1 rounded-xl border-0 px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 ${
            hasRecipe ? "bg-surface-1/70" : "bg-surface-2"
          }`}
        >
          <option value="">— odaberi recept —</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-1 px-3 text-xs font-semibold text-warn">{error}</p>}
    </div>
  );
}
