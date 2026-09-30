"use client";

import { useEffect, useSyncExternalStore } from "react";
import { showToast } from "@/components/Toast";

export type ThemePreference = "light" | "dark" | "system";

const OPTIONS: { value: ThemePreference; label: string }[] = [
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
  applyTheme(value);
  listeners.forEach((notify) => notify());
}

/** Segmentirani Light/Dark/System prekidač. Reused u AppHeader account meniju i na /settings. */
export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Kad je preferencija "system", prati promjenu OS teme uživo (korisnik
  // ne mora ništa kliknuti da se stranica prilagodi).
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      if (normalize(localStorage.getItem("theme")) === "system") applyTheme("system");
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  function handleSelect(value: ThemePreference) {
    setTheme(value);
    showToast("Izgled spremljen.");
  }

  return (
    <div
      role="radiogroup"
      aria-label="Izgled"
      className={`inline-flex gap-1 rounded-xl border border-border bg-surface-2 p-1 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const isActive = pref === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => handleSelect(opt.value)}
            className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 ${
              isActive ? "bg-accent text-white" : "text-ink-muted hover:bg-surface-1"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
