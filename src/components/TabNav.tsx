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
      className="fixed inset-x-3 bottom-3 z-10 flex gap-1 rounded-full bg-white p-1.5 shadow-lg shadow-black/10
        sm:static sm:inset-auto sm:mb-6 sm:gap-2 sm:rounded-none sm:border-b sm:border-gray-200 sm:bg-transparent sm:p-0 sm:shadow-none"
    >
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-colors
              sm:flex-none sm:rounded-none sm:border-b-2 sm:border-transparent sm:px-3 sm:py-3 ${
                isActive
                  ? "bg-brand-dark text-white sm:bg-transparent sm:border-brand sm:text-brand"
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
