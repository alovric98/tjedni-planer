"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { normalize } from "@/lib/normalize";

export type ShoppingListItem = {
  name: string;
  quantity: number;
  unit: string;
};

export async function setDayRecipe(dayOfWeek: number, recipeId: string | null) {
  const { error } = await supabase
    .from("weekly_plan_days")
    .update({ recipe_id: recipeId })
    .eq("day_of_week", dayOfWeek);

  if (error) {
    throw new Error(`Greška kod spremanja odabira: ${error.message}`);
  }

  revalidatePath("/tjedni-plan");
}

export async function generateShoppingList(): Promise<ShoppingListItem[]> {
  const { data, error } = await supabase
    .from("weekly_plan_days")
    .select("recipes(recipe_ingredients(name, quantity, unit))")
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
