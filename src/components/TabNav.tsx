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
    <nav className="sticky bottom-0 z-10 flex border-t border-gray-200 bg-white sm:sticky sm:top-0 sm:border-t-0 sm:border-b">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 py-3 text-center text-sm font-medium ${
              isActive
                ? "border-t-2 border-emerald-600 text-emerald-700 sm:border-t-0 sm:border-b-2"
                : "text-gray-500"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
