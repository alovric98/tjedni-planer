"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

const UNITS = ["g", "kg", "ml", "l", "kom"] as const;
type Unit = (typeof UNITS)[number];

export type RecipeFormState = {
  error?: string;
};

function parseIngredients(formData: FormData) {
  const names = formData.getAll("ingredient_name").map((v) => String(v).trim());
  const quantities = formData.getAll("ingredient_quantity").map((v) => String(v));
  const units = formData.getAll("ingredient_unit").map((v) => String(v));

  const ingredients: { name: string; quantity: number; unit: Unit }[] = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (!name) continue;

    const quantity = Number(quantities[i]?.replace(",", "."));
    const unit = units[i];

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Neispravna količina za sastojak "${name}".`);
    }
    if (!UNITS.includes(unit as Unit)) {
      throw new Error(`Neispravna jedinica mjere za sastojak "${name}".`);
    }

    ingredients.push({ name, quantity, unit: unit as Unit });
  }

  return ingredients;
}

export async function createRecipe(
  _prevState: RecipeFormState,
  formData: FormData
): Promise<RecipeFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Naziv recepta je obavezan." };
  }

  let ingredients;
  try {
    ingredients = parseIngredients(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Neispravan unos sastojaka." };
  }
  if (ingredients.length === 0) {
    return { error: "Dodaj barem jedan sastojak." };
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({ name })
    .select("id")
    .single();

  if (recipeError || !recipe) {
    return { error: `Greška kod spremanja recepta: ${recipeError?.message}` };
  }

  const { error: ingredientsError } = await supabase
    .from("recipe_ingredients")
    .insert(ingredients.map((i) => ({ ...i, recipe_id: recipe.id })));

  if (ingredientsError) {
    return { error: `Greška kod spremanja sastojaka: ${ingredientsError.message}` };
  }

  revalidatePath("/recepti");
  redirect("/recepti");
}

export async function updateRecipe(
  id: string,
  _prevState: RecipeFormState,
  formData: FormData
): Promise<RecipeFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Naziv recepta je obavezan." };
  }

  let ingredients;
  try {
    ingredients = parseIngredients(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Neispravan unos sastojaka." };
  }
  if (ingredients.length === 0) {
    return { error: "Dodaj barem jedan sastojak." };
  }

  const { error: updateError } = await supabase
    .from("recipes")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) {
    return { error: `Greška kod spremanja recepta: ${updateError.message}` };
  }

  const { error: deleteError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", id);
  if (deleteError) {
    return { error: `Greška kod ažuriranja sastojaka: ${deleteError.message}` };
  }

  const { error: insertError } = await supabase
    .from("recipe_ingredients")
    .insert(ingredients.map((i) => ({ ...i, recipe_id: id })));
  if (insertError) {
    return { error: `Greška kod ažuriranja sastojaka: ${insertError.message}` };
  }

  revalidatePath("/recepti");
  redirect("/recepti");
}

export async function deleteRecipe(id: string) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    throw new Error(`Greška kod brisanja recepta: ${error.message}`);
  }
  revalidatePath("/recepti");
}
