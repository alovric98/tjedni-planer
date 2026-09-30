import type { ReactNode } from "react";

/** Prazno stanje liste/ekrana: ikona, naslov, kratko objašnjenje i opcionalna akcija. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-surface border border-dashed border-border-strong px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-muted"
      >
        {icon}
      </div>
      <h2 className="mt-4 text-heading font-semibold text-ink">{title}</h2>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-label text-ink-muted">{children}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/** Greška kod dohvata podataka - isti stil kao na /tjedni-plan. */
export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-surface border border-warn/30 bg-warn-bg px-4 py-3 text-label text-warn">
      {children}
    </p>
  );
}
