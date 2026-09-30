import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { DaySelect } from "./DaySelect";
import { ShoppingListGenerator } from "./ShoppingListGenerator";
import { formatWeekRange, getCurrentWeek } from "./week";

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
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-title text-ink">Tjedni plan</h1>
        <p role="alert" className="mt-3 rounded-surface border border-warn/30 bg-warn-bg px-4 py-3 text-label text-warn">
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
  const recipeIds = new Set(recipes.map((r) => r.id));
  const week = getCurrentWeek();
  const days = week.map((day) => {
    const recipeId = recipeIdByDay.get(day.dayOfWeek) ?? null;
    // A deleted recipe (or one the user cannot see) is treated as an empty day.
    return { ...day, recipeId: recipeId && recipeIds.has(recipeId) ? recipeId : null };
  });
  const plannedCount = days.filter((d) => d.recipeId !== null).length;

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-10">
        <section aria-labelledby="plan-heading">
          <header>
            <h1 id="plan-heading" className="text-title text-ink">
              Tjedni plan
            </h1>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-label text-ink-muted">
              <span className="font-semibold text-ink">{formatWeekRange(week)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {plannedCount} od 7 dana planirano
              </span>
            </p>
          </header>

          <ul className="mt-4 divide-y divide-border rounded-surface border border-border bg-surface-1 shadow-raised">
            {days.map((day) => (
              <DaySelect
                key={day.dayOfWeek}
                dayOfWeek={day.dayOfWeek}
                label={DAY_LABELS[day.dayOfWeek - 1]}
                shortLabel={day.shortLabel}
                dayOfMonth={day.dayOfMonth}
                isToday={day.isToday}
                selectedRecipeId={day.recipeId}
                recipes={recipes}
              />
            ))}
          </ul>
        </section>

        <div className="mt-8 lg:sticky lg:top-[4.5rem] lg:mt-0">
          <ShoppingListGenerator />
        </div>
      </div>
    </div>
  );
}
