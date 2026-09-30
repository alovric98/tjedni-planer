"use client";

import { useState, useTransition } from "react";
import { deleteRecipe } from "./actions";
import { showToast } from "@/components/Toast";
import { iconButtonClasses } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";

export function DeleteRecipeButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      try {
        await deleteRecipe(id);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Greška kod brisanja recepta.", "error");
      } finally {
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Obriši recept ${name}`}
        title="Obriši"
        className={`${iconButtonClasses()} hover:bg-warn-bg hover:text-warn`}
      >
        <TrashIcon className="h-[1.125rem] w-[1.125rem]" />
      </button>

      <ConfirmDialog
        open={open}
        danger
        busy={isPending}
        title="Obrisati recept?"
        confirmLabel="Obriši"
        onConfirm={confirmDelete}
        onCancel={() => setOpen(false)}
      >
        Recept &quot;{name}&quot; bit će trajno obrisan. Ovo se ne može poništiti.
      </ConfirmDialog>
    </>
  );
}
