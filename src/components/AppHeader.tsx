"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu, type AppUser } from "@/components/AccountMenu";
import { DesktopTabs } from "@/components/TabNav";
import { BasketIcon } from "@/components/ui/icons";

export type { AppUser };

export function AppHeader({ user }: { user: AppUser | null }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
        <Link
          href="/recepti"
          className="-ml-1.5 flex min-h-11 items-center gap-2 rounded-control px-1.5 transition-colors duration-150 hover:bg-surface-2"
        >
          <BasketIcon className="h-5 w-5 text-accent-fg" />
          <span className="text-heading font-semibold text-ink">Tjedni planer</span>
        </Link>

        <DesktopTabs />

        <div className="ml-auto">
          {user ? (
            <AccountMenu user={user} />
          ) : (
            <Link
              href="/login"
              className="flex min-h-11 items-center rounded-control px-3 text-label font-semibold text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
            >
              Prijava
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
