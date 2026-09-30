import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "solid" | "warn";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-muted",
  accent: "bg-accent-soft text-accent-fg",
  // Jedina puna accent ispuna - rezervirana za oznaku "jeftinije".
  solid: "bg-accent text-white",
  warn: "bg-warn-bg text-warn",
};

/** Mala oznaka statusa (npr. "uskoro", "jeftinije"). Uvijek uppercase micro. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-semibold uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
