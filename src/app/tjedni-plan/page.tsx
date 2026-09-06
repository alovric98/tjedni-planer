import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { DaySelect } from "./DaySelect";
import { ShoppingListGenerator } from "./ShoppingListGenerator";

export const metadata: Metadata = { title: "Tjedni plan" };

// Recepti se mogu mijenjati na tabu "Recepti" (druga ruta), pa statički
// snapshot ovdje ne bi vidio te promjene bez ovoga.
export const dynamic = "force-dynamic";

const DAY_LABELS = [
  "Ponedjeljak",
  "Utorak",
  "Srijeda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedjelja",
];

export default async function TjedniPlanPage() {
  const [{ data: days, error: daysError }, { data: recipes, error: recipesError }] =
    await Promise.all([
      supabase
        .from("weekly_plan_days")
        .select("day_of_week, recipe_id")
        .order("day_of_week"),
      supabase.from("recipes").select("id, name").order("name"),
    ]);

  if (daysError || recipesError || !days || !recipes) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Tjedni plan</h1>
        <p className="mt-2 text-red-600">
          Greška kod dohvata podataka: {daysError?.message ?? recipesError?.message}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Tjedni plan</h1>

      <div className="mt-4 space-y-2">
        {days.map((day) => (
          <DaySelect
            key={`${day.day_of_week}:${day.recipe_id ?? "none"}`}
            dayOfWeek={day.day_of_week}
            label={DAY_LABELS[day.day_of_week - 1]}
            selectedRecipeId={day.recipe_id}
            recipes={recipes}
          />
        ))}
      </div>

      <div className="mt-6">
        <ShoppingListGenerator />
      </div>
    </div>
  );
}
