type IconProps = { className?: string };

const BASE = "h-4 w-4 shrink-0";

export function CheckIcon({ className = "", draw = false }: IconProps & { draw?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`${BASE} ${className}`} aria-hidden="true">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        // `draw` animates the stroke when the icon mounts (see .animate-check-draw).
        className={draw ? "animate-check-draw" : ""}
      />
    </svg>
  );
}

export function ChevronDownIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`${BASE} ${className}`} aria-hidden="true">
      <path d="m4 6.5 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`${BASE} ${className}`} aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
