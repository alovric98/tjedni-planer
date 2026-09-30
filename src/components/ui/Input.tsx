import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

/**
 * Zajednički stil polja. Namjerno bez width/padding-x - te se vrijednosti
 * razlikuju po polju (naziv, količina, jedinica), a Tailwind ne garantira
 * da kasnija klasa u stringu pobjeđuje raniju, pa ih pozivatelj daje
 * eksplicitno.
 */
export function fieldClasses(invalid = false) {
  return (
    "min-h-11 rounded-control border bg-surface-1 py-2.5 text-label text-ink shadow-raised " +
    "transition-[border-color,box-shadow,background-color] duration-150 " +
    "hover:border-border-strong focus:outline-none focus:ring-[3px] disabled:opacity-50 " +
    (invalid
      ? "border-warn focus:border-warn focus:ring-warn/20"
      : "border-border focus:border-accent focus:ring-accent/20")
  );
}

type FieldProps = { invalid?: boolean };

export function Input({
  invalid,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`${fieldClasses(invalid)} ${className}`}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={`${fieldClasses(invalid)} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
