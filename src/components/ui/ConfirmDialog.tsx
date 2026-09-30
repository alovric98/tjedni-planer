"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destruktivna akcija: potvrda je u warn tonu, a početni fokus ostaje na "Odustani". */
  danger?: boolean;
  /** Potvrda u tijeku: gumb pokazuje spinner, a dijalog se ne može zatvoriti. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modalni dijalog na nativnom <dialog> + showModal(): preglednik sam radi
 * fokus trap, inert pozadinu, Esc i povratak fokusa na okidač. Stil je isti
 * kao picker sheet (shadow-overlay, radius-surface, backdrop ink/40).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Odustani",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React autoFocus ne radi na zatvorenom dialogu; showModal() sam fokusira
      // prvi fokusabilni element ("Odustani"), a ovdje prebacujemo ako treba.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Modalni dijalog ne zaključava scroll pozadine sam - radimo to kao u pickeru.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc: preglednik bi zatvorio dijalog mimo Reacta - zatvaranje ide kroz stanje.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      // Klik na backdrop (target je sam <dialog>, ne njegov sadržaj).
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-surface border border-border-strong bg-surface-1 p-0 text-ink shadow-overlay backdrop:bg-ink/40 open:animate-pop-in"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-heading font-semibold text-ink">
          {title}
        </h2>
        {children && <div className="mt-1.5 text-label text-ink-muted">{children}</div>}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-border p-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" disabled={busy} onClick={onCancel} className="sm:min-h-11">
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          size="lg"
          loading={busy}
          onClick={onConfirm}
          data-autofocus={danger ? undefined : ""}
          className="sm:min-h-11"
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
