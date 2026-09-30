"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { StoreOption } from "@/config/store-options";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} size="lg" fullWidth className="mt-5">
      {pending ? "Spremam…" : "Spremi i nastavi"}
    </Button>
  );
}

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
    <form action={action} className="mt-8 space-y-2.5">
      {options.map((store) => {
        const isChecked = selected.has(store.key);
        return (
          <label
            key={store.key}
            className={`flex min-h-14 items-center gap-3.5 rounded-surface border px-4 py-3.5 shadow-raised transition-[background-color,border-color] duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)] ${
              store.available
                ? `cursor-pointer ${isChecked ? "border-accent bg-accent-soft" : "border-border bg-surface-1 hover:border-border-strong"}`
                : "cursor-not-allowed border-border bg-surface-1 opacity-50"
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
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.4375rem] border transition-[background-color,border-color,transform] duration-150 ${
                isChecked ? "border-accent bg-accent" : "border-border-strong bg-surface-1"
              }`}
            >
              {isChecked && <CheckIcon />}
            </span>
            <span className="text-heading font-semibold text-ink">{store.label}</span>
            {!store.available && (
              <span className="ml-auto">
                <Badge>uskoro</Badge>
              </span>
            )}
          </label>
        );
      })}

      <SubmitButton />
    </form>
  );
}
