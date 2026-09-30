import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2.5 rounded-control font-semibold " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-raised hover:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface-1 text-ink shadow-raised hover:bg-surface-2",
  ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
};

const SIZES: Record<Size, string> = {
  md: "min-h-11 px-4 text-label",
  lg: "min-h-12 px-6 text-[0.9375rem]",
};

/** Klase gumba - za <Link> koji treba izgledati kao gumb. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
}: { variant?: Variant; size?: Size; fullWidth?: boolean } = {}) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? "w-full" : ""}`;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 animate-spin-arc ${className}`} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Prikazuje spinner i blokira klik; širina gumba se ne mijenja. */
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClasses({ variant, size, fullWidth })} ${loading ? "disabled:opacity-100" : ""} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
