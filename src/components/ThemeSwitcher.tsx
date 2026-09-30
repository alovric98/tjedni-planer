"use client";

import { useEffect, useSyncExternalStore } from "react";
import { showToast } from "@/components/Toast";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Svijetlo" },
  { value: "dark", label: "Tamno" },
  { value: "system", label: "Sustav" },
];

function normalize(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

function applyTheme(pref: ThemePreference) {
  const isDark =
    pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

// useSyncExternalStore, ne useState+useEffect: localStorage je izvor izvan
// Reacta i različit je na serveru (getServerSnapshot) vs klijentu
// (getSnapshot) - ovo je React-preporučeni način da se to čita bez
// hydration mismatcha ili setState-a unutar effecta.
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): ThemePreference {
  return normalize(localStorage.getItem("theme"));
}

function getServerSnapshot(): ThemePreference {
  return "system";
}

function setTheme(value: ThemePreference) {
  localStorage.setItem("theme", value);
  // Kratko uključi blagu tranziciju boja (vidi .theme-transition u
  // globals.css) da promjena teme ne "škljocne".
  const root = document.documentElement;
  root.classList.add("theme-transition");
  applyTheme(value);
  window.setTimeout(() => root.classList.remove("theme-transition"), 300);
  listeners.forEach((notify) => notify());
}

/**
 * Stanje teme za sve prikaze prekidača (ThemeSwitcher, account meni). Kad je
 * preferencija "system", prati promjenu OS teme uživo (korisnik ne mora ništa
 * kliknuti da se stranica prilagodi).
 */
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      if (normalize(localStorage.getItem("theme")) === "system") applyTheme("system");
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  function select(value: ThemePreference) {
    setTheme(value);
    showToast("Izgled spremljen.");
  }

  return { pref, select };
}

/** Segmentirani Light/Dark/System prekidač. Koristi se na /settings (u account meniju su isti izbori kao menuitemradio). */
export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const { pref, select } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Izgled"
      className={`inline-flex gap-0.5 rounded-control border border-border bg-surface-2 p-0.5 ${className}`}
    >
      {THEME_OPTIONS.map((opt) => {
        const isActive = pref === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => select(opt.value)}
            className={`min-h-10 flex-1 rounded-[0.5rem] px-3 text-label font-semibold transition-[background-color,color,box-shadow] duration-150 ${
              isActive
                ? "bg-surface-1 text-ink shadow-raised ring-1 ring-border-strong"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
