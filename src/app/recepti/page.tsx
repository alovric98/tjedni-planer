import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { RecipeCard } from "./RecipeCard";

export const metadata: Metadata = { title: "Recepti" };

// Male, osobne aplikacije - jednostavnije i sigurnije uvijek čitati uživo
// nego pratiti lanac revalidatePath poziva kroz sve ovisne rute.
export const dynamic = "force-dynamic";

export default async function ReceptiPage() {
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, name, recipe_ingredients(name, quantity, unit)")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ink">Recepti</h1>
        <p className="mt-2 text-accent-red-ink">Greška kod dohvata recepata: {error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Recepti</h1>
        <Link
          href="/recepti/novi"
          className="rounded-full bg-brand-dark px-4 py-2 text-sm font-semibold text-white"
        >
          + Novi recept
        </Link>
      </div>

      {recipes.length === 0 ? (
        <p className="mt-4 text-ink-muted">Nema recepata, dodaj prvi.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              id={recipe.id}
              name={recipe.name}
              ingredients={recipe.recipe_ingredients}
            />
          ))}
        </div>
      )}
    </div>
  );
}
