import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RecipeForm } from "../../RecipeForm";

export default async function UrediReceptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id, name, recipe_ingredients(name, quantity, unit)")
    .eq("id", id)
    .single();

  if (error || !recipe) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Uredi recept</h1>
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
