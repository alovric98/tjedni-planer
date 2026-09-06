"use client";

import { useTransition } from "react";
import { deleteRecipe } from "./actions";

export function DeleteRecipeButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (window.confirm("Obrisati ovaj recept?")) {
          startTransition(() => {
            deleteRecipe(id);
          });
        }
      }}
      className="text-red-600 disabled:opacity-50"
    >
      Obriši
    </button>
  );
}
