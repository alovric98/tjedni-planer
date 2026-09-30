import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState, ErrorNotice } from "@/components/ui/EmptyState";
import { BookIcon, PlusIcon } from "@/components/ui/icons";
import { RecipeCard } from "./RecipeCard";

export const metadata: Metadata = { title: "Recepti" };

// Male, osobne aplikacije - jednostavnije i sigurnije uvijek čitati uživo
// nego pratiti lanac revalidatePath poziva kroz sve ovisne rute.
export const dynamic = "force-dynamic";

// "1 recept / 2 recepta / 5 recepata" (11-14 uvijek "recepata").
function pluralRecepata(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "recepata";
  if (mod10 === 1) return "recept";
  if (mod10 >= 2 && mod10 <= 4) return "recepta";
  return "recepata";
}

export default async function ReceptiPage() {
  const { supabase, user } = await requireUser();
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, name, recipe_ingredients(name, quantity, unit)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-title text-ink">Recepti</h1>
        <div className="mt-4">
          <ErrorNotice>Greška kod dohvata recepata: {error.message}</ErrorNotice>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-title text-ink">Recepti</h1>
          {recipes.length > 0 && (
            <p className="mt-1 text-label text-ink-muted">
              {recipes.length} {pluralRecepata(recipes.length)}
            </p>
          )}
        </div>
        {recipes.length > 0 && (
          <Link href="/recepti/novi" className={buttonClasses()}>
            <PlusIcon />
            Novi recept
          </Link>
        )}
      </div>

      {recipes.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<BookIcon className="h-6 w-6" />}
            title="Još nemaš recepata"
            action={
              <Link href="/recepti/novi" className={buttonClasses({ size: "lg" })}>
                <PlusIcon />
                Dodaj prvi recept
              </Link>
            }
          >
            Dodaj recept sa sastojcima pa ga rasporedi u tjedni plan.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-3 lg:grid-cols-2">
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
