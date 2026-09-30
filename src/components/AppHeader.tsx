"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export type AppUser = {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

function BrandMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-accent-fg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18l-1.6 10.4a2 2 0 0 1-2 1.6H6.6a2 2 0 0 1-2-1.6L3 7Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V6a4 4 0 0 1 8 0v1" />
    </svg>
  );
}

function initialFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  return source.charAt(0).toUpperCase();
}

function AccountMenu({ user }: { user: AppUser }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Račun"
        className="flex min-h-12 min-w-12 items-center justify-center rounded-full transition-colors duration-200 hover:bg-surface-2"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-ink"
          >
            {initialFrom(user.name, user.email)}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-border bg-surface-1 p-1.5">
          {user.email && <p className="truncate px-3 py-2 text-xs font-medium text-ink-muted">{user.email}</p>}

          <span
            role="menuitem"
            aria-disabled="true"
            className="flex min-h-12 items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold text-ink-muted"
          >
            Profil
            <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
              uskoro
            </span>
          </span>

          <div className="my-1 border-t border-border" />

          <div role="menuitem" className="px-3 py-2">
            <p className="mb-1.5 text-xs font-medium text-ink-muted">Izgled</p>
            <ThemeSwitcher />
          </div>

          <div className="my-1 border-t border-border" />

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center rounded-lg px-3 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
          >
            Postavke
          </Link>

          <Link
            href="/onboarding"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center rounded-lg px-3 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
          >
            Uredi odabir trgovina
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex min-h-12 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
          >
            Odjava
          </button>
        </div>
      )}
    </div>
  );
}

export function AppHeader({ user }: { user: AppUser | null }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/recepti" className="flex items-center gap-2">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight text-ink">Tjedni planer</span>
        </Link>

        {user ? (
          <AccountMenu user={user} />
        ) : (
          <Link href="/login" className="text-sm font-semibold text-ink-muted underline underline-offset-2">
            Prijava
          </Link>
        )}
      </div>
    </header>
  );
}
