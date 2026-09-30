import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { RecipeForm } from "../../RecipeForm";

export const metadata: Metadata = { title: "Uredi recept" };

export default async function UrediReceptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id, name, recipe_ingredients(name, quantity, unit)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !recipe) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Uredi recept</h1>
      <div className="mt-4">
        <RecipeForm
          mode="edit"
          recipe={{
            id: recipe.id,
            name: recipe.name,
            ingredients: recipe.recipe_ingredients,
          }}
        />
      </div>
    </div>
  );
}
