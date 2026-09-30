"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { normalize } from "@/lib/normalize";

export type ShoppingListItem = {
  name: string;
  quantity: number;
  unit: string;
};

export async function setDayRecipe(dayOfWeek: number, recipeId: string | null) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("weekly_plan_days")
    .upsert(
      { user_id: user.id, day_of_week: dayOfWeek, recipe_id: recipeId },
      { onConflict: "user_id,day_of_week" }
    );

  if (error) {
    throw new Error(`Greška kod spremanja odabira: ${error.message}`);
  }

  revalidatePath("/tjedni-plan");
}

export async function generateShoppingList(): Promise<ShoppingListItem[]> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("weekly_plan_days")
    .select("recipes(recipe_ingredients(name, quantity, unit))")
    .eq("user_id", user.id)
    .not("recipe_id", "is", null);

  if (error) {
    throw new Error(`Greška kod generiranja popisa: ${error.message}`);
  }

  const totals = new Map<string, ShoppingListItem>();

  for (const day of data) {
    const ingredients = day.recipes?.recipe_ingredients ?? [];
    for (const ingredient of ingredients) {
      const key = `${normalize(ingredient.name)}|${ingredient.unit}`;
      const existing = totals.get(key);
      if (existing) {
        existing.quantity += ingredient.quantity;
      } else {
        totals.set(key, { ...ingredient });
      }
    }
  }

  return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name, "hr"));
}
