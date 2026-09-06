"use client";

import { useTransition } from "react";
import { setDayRecipe } from "./actions";

type DaySelectProps = {
  dayOfWeek: number;
  label: string;
  selectedRecipeId: string | null;
  recipes: { id: string; name: string }[];
};

export function DaySelect({ dayOfWeek, label, selectedRecipeId, recipes }: DaySelectProps) {
  const [isPending, startTransition] = useTransition();
  const hasRecipe = selectedRecipeId !== null;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-3 transition-colors ${
        hasRecipe ? "bg-accent-green" : "bg-white"
      }`}
    >
      <span
        className={`w-[4.5rem] shrink-0 text-sm font-semibold ${
          hasRecipe ? "text-accent-green-ink" : "text-ink"
        }`}
      >
        {label}
      </span>
      <select
        defaultValue={selectedRecipeId ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value || null;
          startTransition(() => {
            setDayRecipe(dayOfWeek, value);
          });
        }}
        className={`min-w-0 flex-1 rounded-xl border-0 px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 ${
          hasRecipe ? "bg-white/70" : "bg-gray-100"
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
  );
}
