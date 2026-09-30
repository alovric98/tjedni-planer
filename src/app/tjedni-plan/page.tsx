import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
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
  const { supabase, user } = await requireUser();

  const [{ data: existingDays, error: daysError }, { data: recipes, error: recipesError }] =
    await Promise.all([
      supabase
        .from("weekly_plan_days")
        .select("day_of_week, recipe_id")
        .eq("user_id", user.id),
      supabase.from("recipes").select("id, name").eq("user_id", user.id).order("name"),
    ]);

  if (daysError || recipesError || !existingDays || !recipes) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-ink">Tjedni plan</h1>
        <p className="mt-2 text-warn">
          Greška kod dohvata podataka: {daysError?.message ?? recipesError?.message}
        </p>
      </div>
    );
  }

  // Korisnik možda još nema redak za svaki dan (weekly_plan_days se sad
  // puni per-user tek pri prvom odabiru, umjesto da postoji 7 unaprijed
  // pripremljenih globalnih redaka) - nedostajući dani se prikazuju kao
  // prazan odabir.
  const recipeIdByDay = new Map(existingDays.map((d) => [d.day_of_week, d.recipe_id]));
  const days = DAY_LABELS.map((_, i) => {
    const dayOfWeek = i + 1;
    return { day_of_week: dayOfWeek, recipe_id: recipeIdByDay.get(dayOfWeek) ?? null };
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Tjedni plan</h1>

      <div className="mt-4 space-y-2.5">
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
