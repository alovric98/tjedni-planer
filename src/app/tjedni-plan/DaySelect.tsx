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

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <span className="w-24 shrink-0 text-sm font-medium text-gray-700">{label}</span>
      <select
        defaultValue={selectedRecipeId ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value || null;
          startTransition(() => {
            setDayRecipe(dayOfWeek, value);
          });
        }}
        className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
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
