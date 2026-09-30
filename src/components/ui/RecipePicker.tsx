"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type PickerOption = { value: string; label: string };

type RecipePickerProps = {
  value: string | null;
  options: PickerOption[];
  onChange: (value: string | null) => void;
  /** Pristupačan naziv popisa, npr. "Recepti za ponedjeljak". Naziv gumba dolazi iz njegovog sadržaja. */
  label: string;
  /** Naslov bottom sheeta na mobitelu. */
  sheetTitle: string;
  /** Tekst opcije koja briše odabir; prikazuje se samo dok je nešto odabrano. */
  clearLabel: string;
  /** Spremanje u tijeku: gumb ostaje fokusabilan (ne gubi fokus), ali se popis ne otvara. */
  busy?: boolean;
  /** Sadržaj gumba (okidača). Stil gumba dolazi iz `triggerClassName`. */
  children: ReactNode;
  triggerClassName?: string;
};

/**
 * Stilizirani zamjenski <select> (listbox obrazac iz WAI-ARIA APG):
 * gumb otvara popis s role="listbox"/"option". Tipkovnica: strelice, Home/End,
 * PageUp/PageDown, Enter/Space, Escape, Tab i typeahead. Na mobitelu se popis
 * prikazuje kao bottom sheet s velikim recima, od `sm` kao popover.
 *
 * NAPOMENA: predak koji koristi transform/filter lomi `fixed` sheet na
 * mobitelu - ne stavljati ih na roditelje ove komponente.
 */
export function RecipePicker({
  value,
  options,
  onChange,
  label,
  sheetTitle,
  clearLabel,
  busy = false,
  children,
  triggerClassName = "",
}: RecipePickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", timer: 0 });
  const baseId = useId();

  const items: { value: string | null; label: string }[] =
    value === null ? options : [{ value: null, label: clearLabel }, ...options];
  const selectedIndex = items.findIndex((i) => i.value === value);
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  function openList() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function choose(index: number) {
    const item = items[index];
    if (!item) return;
    close();
    if (item.value !== value) onChange(item.value);
  }

  // Fokus na popis pri otvaranju (aria-activedescendant upravlja aktivnom opcijom).
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Aktivna opcija uvijek vidljiva pri kretanju strelicama.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, baseId]);

  // Klik izvan zatvara popover; na mobitelu backdrop preuzima klik.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Sheet je modalan samo na mobitelu - zaključaj scroll pozadine.
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 39.99rem)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

  function onButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!busy && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      openList();
    }
  }

  function onListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const last = items.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, last));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      case "PageDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 5, last));
        return;
      case "PageUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 5, 0));
        return;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        e.preventDefault();
        setActiveIndex(last);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(activeIndex);
        return;
      case "Escape":
        e.preventDefault();
        close();
        return;
      case "Tab":
        close(false);
        return;
    }

    // Typeahead: slova se skupljaju ~600 ms, skok na prvu opciju s tim prefiksom.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      window.clearTimeout(typeahead.current.timer);
      typeahead.current.text += e.key.toLocaleLowerCase("hr");
      typeahead.current.timer = window.setTimeout(() => {
        typeahead.current.text = "";
      }, 600);
      const match = items.findIndex((i) => i.label.toLocaleLowerCase("hr").startsWith(typeahead.current.text));
      if (match >= 0) setActiveIndex(match);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${open ? "z-20" : ""}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-busy={busy || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-list` : undefined}
        onClick={() => {
          if (open) close();
          else if (!busy) openList();
        }}
        onKeyDown={onButtonKeyDown}
        className={triggerClassName}
      >
        {children}
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => close()}
            className="animate-fade-in fixed inset-0 z-40 bg-ink/40 sm:hidden"
          />
          <div
            className="animate-picker-in fixed inset-x-0 bottom-0 z-50 flex max-h-[78dvh] flex-col rounded-t-surface border border-b-0 border-border-strong bg-surface-1 shadow-overlay sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:z-30 sm:mt-1.5 sm:max-h-80 sm:w-full sm:min-w-64 sm:rounded-surface sm:border-b"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 sm:hidden">
              <span className="text-heading font-medium text-ink">{sheetTitle}</span>
              <button
                type="button"
                onClick={() => close()}
                className="-mr-2 min-h-12 rounded-control px-3 text-label font-semibold text-ink-muted hover:text-ink"
              >
                Zatvori
              </button>
            </div>
            <ul
              ref={listRef}
              id={`${baseId}-list`}
              role="listbox"
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={items.length > 0 ? optionId(activeIndex) : undefined}
              onKeyDown={onListKeyDown}
              className="overflow-y-auto overscroll-contain p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] focus:outline-none"
            >
              {items.map((item, i) => {
                const selected = item.value === value;
                const isClear = item.value === null;
                return (
                  <li
                    key={item.value ?? "__clear"}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(i)}
                    onPointerMove={() => i !== activeIndex && setActiveIndex(i)}
                    className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-control px-3.5 py-2.5 text-[0.9375rem] transition-colors duration-100 ${
                      i === activeIndex ? "bg-surface-2" : ""
                    } ${selected ? "font-semibold text-ink" : isClear ? "text-ink-muted" : "text-ink"}`}
                  >
                    <span className="min-w-0">{item.label}</span>
                    {selected && (
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 text-accent-fg" aria-hidden="true">
                        <path
                          d="M3.5 8.5 6.5 11.5 12.5 4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </li>
                );
              })}
              {items.length === 0 && <li className="px-3.5 py-3 text-label text-ink-muted">Nema recepata.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
