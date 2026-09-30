"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { BasketIcon, BookIcon, CalendarIcon } from "@/components/ui/icons";

const TABS: { href: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { href: "/recepti", label: "Recepti", Icon: BookIcon },
  { href: "/tjedni-plan", label: "Tjedni plan", Icon: CalendarIcon },
  { href: "/kosarica", label: "Košarica", Icon: BasketIcon },
];

function isActiveTab(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop (od `sm`): tabovi žive u headeru. Na mobitelu je `hidden`
 * (display:none), pa je u pristupačnom stablu samo jedan "Glavna navigacija"
 * landmark odjednom - drugi je MobileTabBar.
 */
export function DesktopTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Glavna navigacija" className="ml-4 hidden items-center gap-1 sm:flex">
      {TABS.map(({ href, label }) => {
        const active = isActiveTab(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-control px-3.5 text-label font-semibold transition-colors duration-150 ${
              active ? "bg-accent-soft text-accent-fg" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Mobilni donji pill nav: fiksan, iznad safe-area, touch target 56px. Visina
 * (+ razmak + safe-area) je u --nav-offset (globals.css) - main padding, Toast
 * i sticky trake se oslanjaju na nju da ih nav ne prekrije.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav
      aria-label="Glavna navigacija"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md gap-1 rounded-full border border-border-strong bg-surface-1/95 p-1.5 shadow-overlay backdrop-blur-md sm:hidden"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = isActiveTab(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-label font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${
              active ? "bg-accent text-white" : "text-ink-muted hover:bg-surface-2 hover:text-ink active:bg-surface-2"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
