"use client";

import { useActionState, useState } from "react";
import { createRecipe, updateRecipe, type RecipeFormState } from "./actions";

const UNITS = ["g", "kg", "ml", "l", "kom"] as const;

// Namjerno bez width/padding ovdje - te vrijednosti se razlikuju po polju
// (naziv, količina, jedinica), a Tailwind ne garantira da će kasnija klasa u
// stringu (npr. "w-20") pobijediti raniju ("w-full") po CSS specifičnosti,
// pa ih dodajemo eksplicitno na svakom pozivu umjesto da se oslanjamo na
// redoslijed u className stringu.
const fieldClass =
  "rounded-2xl border-0 bg-gray-100 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand";

type IngredientRow = { key: string; name: string; quantity: string; unit: string };

function makeEmptyRow(): IngredientRow {
  return { key: crypto.randomUUID(), name: "", quantity: "", unit: "g" };
}

type RecipeFormProps = {
  mode: "create" | "edit";
  recipe?: {
    id: string;
    name: string;
    ingredients: { name: string; quantity: number; unit: string }[];
  };
};

const initialState: RecipeFormState = {};

export function RecipeForm({ mode, recipe }: RecipeFormProps) {
  const action = mode === "edit" && recipe ? updateRecipe.bind(null, recipe.id) : createRecipe;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [name, setName] = useState(recipe?.name ?? "");

  const [rows, setRows] = useState<IngredientRow[]>(() =>
    recipe && recipe.ingredients.length > 0
      ? recipe.ingredients.map((i) => ({
          key: crypto.randomUUID(),
          name: i.name,
          quantity: String(i.quantity),
          unit: i.unit,
        }))
      : [makeEmptyRow()]
  );

  function updateRow(key: string, patch: Partial<IngredientRow>) {
    setRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rows) => [...rows, makeEmptyRow()]);
  }

  function removeRow(key: string) {
    setRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-ink" htmlFor="name">
          Naziv recepta
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`mt-2 w-full px-4 ${fieldClass}`}
        />
      </div>

      <div>
        <span className="block text-sm font-semibold text-ink">Sastojci</span>
        <div className="mt-2 space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="rounded-2xl bg-gray-50 p-2.5 sm:flex sm:items-center sm:gap-2 sm:bg-transparent sm:p-0">
              <input
                name="ingredient_name"
                type="text"
                placeholder="Naziv sastojka"
                value={row.name}
                onChange={(e) => updateRow(row.key, { name: e.target.value })}
                className={`w-full min-w-0 px-4 sm:flex-1 ${fieldClass}`}
              />
              <div className="mt-2 flex gap-2 sm:mt-0 sm:contents">
                <input
                  name="ingredient_quantity"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Kol."
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  className={`w-20 shrink-0 px-3 ${fieldClass}`}
                />
                <select
                  name="ingredient_unit"
                  value={row.unit}
                  onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                  className={`w-24 shrink-0 px-2 ${fieldClass}`}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="shrink-0 px-1 text-ink-muted hover:text-accent-red-ink"
                  aria-label="Makni sastojak"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="mt-3 text-sm font-semibold text-brand">
          + Dodaj sastojak
        </button>
      </div>

      {state.error && <p className="text-sm text-accent-red-ink">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-dark px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {mode === "create" ? "Spremi recept" : "Spremi izmjene"}
      </button>
    </form>
  );
}
