"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CheckIcon } from "./icons";

export type PickerOption = { value: string; label: string };

type RecipePickerProps = {
  value: string | null;
  options: PickerOption[];
  onChange: (value: string | null) => void;
  /** Accessible name of the list, e.g. "Recipes for Monday". The button takes its name from its content. */
  label: string;
  /** Title of the bottom sheet on mobile. */
  sheetTitle: string;
  /** Label of the option that clears the selection; only shown while something is selected. */
  clearLabel: string;
  /** Save in progress: the button keeps focus but the list will not open. */
  busy?: boolean;
  /** Trigger button content. Button styling comes from `triggerClassName`. */
  children: ReactNode;
  triggerClassName?: string;
};

/**
 * Styled replacement for a native <select> (WAI-ARIA APG listbox pattern):
 * a button opens a role="listbox" list. Keyboard: arrows, Home/End,
 * PageUp/PageDown, Enter/Space, Escape, Tab and typeahead (Space extends the
 * typeahead buffer while it is non-empty). On mobile the list is a bottom
 * sheet with large rows, from `sm` up it is a popover.
 *
 * NOTE: an ancestor with transform/filter breaks the `fixed` mobile sheet, so
 * do not put those on parents of this component.
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
  // Decided at open time: below `sm` the list is a modal bottom sheet.
  const [isSheet, setIsSheet] = useState(false);
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
    setIsSheet(window.matchMedia("(max-width: 39.99rem)").matches);
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

  // Move focus to the list on open (aria-activedescendant tracks the active option).
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Keep the active option in view while moving with the arrow keys.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, baseId]);

  // Outside click closes the popover (on mobile the backdrop handles it), and
  // Escape closes even if focus has drifted away from the list.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The sheet is modal - lock background scroll while it is open.
  useEffect(() => {
    if (!open || !isSheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, isSheet]);

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

  function onButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!busy && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      openList();
    }
  }

  function onListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const last = items.length - 1;

    // Typeahead: letters accumulate for ~600 ms and jump to the first option
    // with that prefix. Space only counts as a letter once a prefix has started,
    // otherwise it selects (so multi-word names like "pileća juha" work).
    const isTypeaheadKey =
      e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key !== " " || typeahead.current.text !== "");
    if (isTypeaheadKey) {
      e.preventDefault();
      window.clearTimeout(typeahead.current.timer);
      typeahead.current.text += e.key.toLocaleLowerCase("hr");
      typeahead.current.timer = window.setTimeout(() => {
        typeahead.current.text = "";
      }, 600);
      const match = items.findIndex((i) => i.label.toLocaleLowerCase("hr").startsWith(typeahead.current.text));
      if (match >= 0) setActiveIndex(match);
      return;
    }

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

  }

  return (
    // No z-index on mobile: a stacking context here would trap the fixed sheet under the header/nav.
    <div ref={containerRef} className={`relative ${open ? "sm:z-20" : ""}`}>
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
            role={isSheet ? "dialog" : undefined}
            aria-modal={isSheet || undefined}
            aria-label={isSheet ? sheetTitle : undefined}
            // Keeps focus on the list when tapping non-focusable parts of the sheet.
            onMouseDown={(e) => e.preventDefault()}
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
                      <CheckIcon className="text-accent-fg" />
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
