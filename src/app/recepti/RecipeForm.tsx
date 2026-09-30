"use client";

import { useActionState, useEffect, useState } from "react";
import { createRecipe, updateRecipe, type RecipeFormState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { clearFlag, readFlag, RELOGIN_FLAG } from "@/lib/session-flags";

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

type Draft = { name: string; rows: IngredientRow[] };

function draftKey(mode: string, id?: string) {
  return `tjedni-planer:recipe-draft:${mode}:${id ?? "new"}`;
}

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

  // The draft is written on every submit attempt. If the session has expired
  // the request is redirected to /login and this page is lost; after the
  // re-login (RELOGIN_FLAG set by the login screen) the draft is restored.
  // Without the flag a leftover draft is stale (the save succeeded), so drop it.
  const storageKey = draftKey(mode, recipe?.id);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw && readFlag(RELOGIN_FLAG)) {
        const draft = JSON.parse(raw) as Draft;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore after mount (sessionStorage is client-only)
        setName(draft.name);
        if (draft.rows.length > 0) setRows(draft.rows);
      }
      sessionStorage.removeItem(storageKey);
    } catch {}
    clearFlag(RELOGIN_FLAG);
  }, [storageKey]);

  function saveDraft() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ name, rows } satisfies Draft));
    } catch {}
  }

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
    <form action={formAction} onSubmit={saveDraft} className="space-y-6">
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
