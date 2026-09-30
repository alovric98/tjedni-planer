"use client";

import { useTransition } from "react";
import { deleteRecipe } from "./actions";
import { showToast } from "@/components/Toast";

export function DeleteRecipeButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (window.confirm("Obrisati ovaj recept?")) {
          startTransition(async () => {
            try {
              await deleteRecipe(id);
            } catch (e) {
              showToast(e instanceof Error ? e.message : "Greška kod brisanja recepta.");
            }
          });
        }
      }}
      className="flex min-h-12 items-center px-2 text-warn disabled:opacity-50"
    >
      Obriši
    </button>
  );
}
