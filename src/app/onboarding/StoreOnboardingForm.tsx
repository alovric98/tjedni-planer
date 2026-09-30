"use client";

import { useState } from "react";
import type { StoreOption } from "@/config/store-options";

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Onboarding checkbox stilski prati istu vizualnu logiku kao
 * ShoppingListRow (kvačica se puni accent-zelenom) - jedini razlog za
 * Client Component ovdje je live preview stanja prije submita; sam upis se
 * i dalje radi kroz Server Action (saveStoreSelection).
 */
export function StoreOnboardingForm({
  options,
  initialSelected,
  action,
}: {
  options: StoreOption[];
  initialSelected: string[];
  action: (formData: FormData) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <form action={action} className="mt-6 space-y-2">
      {options.map((store) => {
        const isChecked = selected.has(store.key);
        return (
          <label
            key={store.key}
            className={`flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3.5 transition-colors duration-200 ${
              store.available ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
          >
            <input
              type="checkbox"
              name={store.key}
              checked={isChecked}
              disabled={!store.available}
              onChange={() => toggle(store.key)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200 ${
                isChecked ? "border-accent bg-accent" : "border-border bg-surface-1"
              }`}
            >
              {isChecked && <CheckIcon />}
            </span>
            <span className="text-lg font-semibold text-ink">{store.label}</span>
            {!store.available && (
              <span className="ml-auto text-xs font-medium text-ink-muted">uskoro</span>
            )}
          </label>
        );
      })}

      <button
        type="submit"
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-accent-hover"
      >
        Spremi i nastavi
      </button>
    </form>
  );
}
