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

// Ikone ispod primaju veličinu kroz className (default 16px) jer Tailwind ne
// garantira da kasnija h-/w- klasa pobjeđuje raniju u istom stringu.
function outline(paths: string[], viewBox = "0 0 24 24") {
  return function Icon({ className = "h-4 w-4" }: IconProps) {
    return (
      <svg
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 ${className}`}
        aria-hidden="true"
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  };
}

export const BookIcon = outline(["M4 5.5A1.5 1.5 0 0 1 5.5 4H19v15H5.5A1.5 1.5 0 0 0 4 20.5v-15Z", "M4 20.5A1.5 1.5 0 0 0 5.5 22H19v-3"]);
export const CalendarIcon = outline(["M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z", "M4 10h16", "M8 3v4", "M16 3v4"]);
export const BasketIcon = outline(["M3 7h18l-1.6 10.4a2 2 0 0 1-2 1.6H6.6a2 2 0 0 1-2-1.6L3 7Z", "M8 7V6a4 4 0 0 1 8 0v1"]);
export const PencilIcon = outline(["M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z", "m14.5 7.5 3 3"]);
export const TrashIcon = outline(["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12", "M9 7V4h6v3"]);
