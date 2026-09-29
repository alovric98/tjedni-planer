"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/recepti", label: "Recepti" },
  { href: "/tjedni-plan", label: "Tjedni plan" },
  { href: "/kosarica", label: "Košarica" },
] as const;

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-10 flex gap-1 rounded-full border border-border bg-surface-1 p-1.5
        sm:static sm:inset-auto sm:mb-6 sm:gap-2 sm:rounded-none sm:border-x-0 sm:border-t-0 sm:border-b sm:border-border sm:bg-transparent sm:p-0"
    >
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex min-h-12 flex-1 items-center justify-center rounded-full py-2.5 text-center text-sm font-semibold transition-colors duration-200
              sm:min-h-0 sm:flex-none sm:rounded-none sm:border-b-2 sm:border-transparent sm:px-3 sm:py-3 ${
                isActive
                  ? "bg-accent text-white sm:bg-transparent sm:border-accent sm:text-accent"
                  : "text-ink-muted"
              }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
