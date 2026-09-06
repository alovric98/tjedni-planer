"use client";

import { useActionState, useState } from "react";
import { createRecipe, updateRecipe, type RecipeFormState } from "./actions";

const UNITS = ["g", "kg", "ml", "l", "kom"] as const;

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
        <label className="block text-sm font-medium text-gray-700" htmlFor="name">
          Naziv recepta
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700">Sastojci</span>
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex gap-2">
              <input
                name="ingredient_name"
                type="text"
                placeholder="Naziv sastojka"
                value={row.name}
                onChange={(e) => updateRow(row.key, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                name="ingredient_quantity"
                type="number"
                step="any"
                min="0"
                placeholder="Kol."
                value={row.quantity}
                onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                name="ingredient_unit"
                value={row.unit}
                onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
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
                className="px-2 text-gray-400 hover:text-red-600"
                aria-label="Makni sastojak"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="mt-2 text-sm font-medium text-emerald-700">
          + Dodaj sastojak
        </button>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {mode === "create" ? "Spremi recept" : "Spremi izmjene"}
      </button>
    </form>
  );
}
