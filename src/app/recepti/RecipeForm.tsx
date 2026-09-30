"use client";

import { useActionState, useState } from "react";
import { createRecipe, updateRecipe, type RecipeFormState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";

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
  const [justAddedKey, setJustAddedKey] = useState<string | null>(null);

  function updateRow(key: string, patch: Partial<IngredientRow>) {
    setRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const row = makeEmptyRow();
    setRows((rows) => [...rows, row]);
    setJustAddedKey(row.key);
  }

  function removeRow(key: string) {
    setRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label className="block text-label font-semibold text-ink" htmlFor="name">
          Naziv recepta
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full px-4"
        />
      </div>

      <div>
        <span className="block text-label font-semibold text-ink">Sastojci</span>
        <div className="mt-2 space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="rounded-surface border border-border bg-surface-2 p-2.5 sm:flex sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0">
              <Input
                name="ingredient_name"
                type="text"
                placeholder="Naziv sastojka"
                value={row.name}
                autoFocus={row.key === justAddedKey}
                onChange={(e) => updateRow(row.key, { name: e.target.value })}
                className="w-full min-w-0 px-4 sm:flex-1"
              />
              <div className="mt-2 flex gap-2 sm:mt-0 sm:contents">
                <Input
                  name="ingredient_quantity"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Kol."
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  className="w-20 shrink-0 px-3"
                />
                <Select
                  name="ingredient_unit"
                  value={row.unit}
                  onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                  className="w-24 shrink-0 px-2"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="flex min-h-11 w-9 shrink-0 items-center justify-center rounded-control text-ink-subtle transition-colors duration-150 hover:bg-warn-bg hover:text-warn"
                  aria-label="Makni sastojak"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={addRow} className="mt-2 -ml-2">
          + Dodaj sastojak
        </Button>
      </div>

      {state.error && <p className="text-label text-warn">{state.error}</p>}

      <Button type="submit" loading={pending} size="lg">
        {mode === "create" ? "Spremi recept" : "Spremi izmjene"}
      </Button>
    </form>
  );
}
