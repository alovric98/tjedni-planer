"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { THEME_OPTIONS, useTheme } from "@/components/ThemeSwitcher";
import { Badge } from "@/components/ui/Badge";

export type AppUser = {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

const ITEM =
  "flex min-h-12 w-full items-center justify-between gap-3 rounded-control px-3 text-left text-label font-semibold text-ink " +
  "transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:-outline-offset-2 sm:min-h-11";

function initialFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  return source.charAt(0).toUpperCase();
}

function Separator() {
  return <div role="separator" className="my-1.5 border-t border-border" />;
}

/**
 * Account dropdown (WAI-ARIA APG menu button): Enter/Space/strelice otvaraju,
 * strelice + Home/End mijenjaju fokus (roving tabindex), Esc zatvara i vraća
 * fokus na okidač, Tab zatvara, klik izvan zatvara. Izbor teme su
 * menuitemradio redovi (radiogroup unutar menuitema nije validan ARIA).
 */
export function AccountMenu({ user }: { user: AppUser }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { pref, select } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Koji item dobiva fokus čim se meni otvori (strelica gore → zadnji).
  const initialFocus = useRef<"first" | "last">("first");
  const menuId = useId();
  const themeLabelId = useId();

  function items(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const list = items();
    (initialFocus.current === "last" ? list[list.length - 1] : list[0])?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      initialFocus.current = e.key === "ArrowUp" ? "last" : "first";
      setOpen(true);
    }
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusAt(index + 1);
        return;
      case "ArrowUp":
        e.preventDefault();
        focusAt(index - 1);
        return;
      case "ArrowRight":
      case "ArrowLeft":
        // Horizontalne strelice samo unutar segmentiranog izbora teme.
        if ((e.target as HTMLElement).getAttribute("role") === "menuitemradio") {
          e.preventDefault();
          focusAt(index + (e.key === "ArrowRight" ? 1 : -1));
        }
        return;
      case "Home":
        e.preventDefault();
        focusAt(0);
        return;
      case "End":
        e.preventDefault();
        focusAt(list.length - 1);
        return;
      case " ":
        // Linkovi se nativno aktiviraju samo Enterom; menuitem mora i Space.
        if ((e.target as HTMLElement).tagName === "A") {
          e.preventDefault();
          (e.target as HTMLElement).click();
        }
        return;
      case "Tab":
        close(false);
        return;
    }
  }

  async function handleLogout() {
    close(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative -mr-1.5">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (open) {
            close(false);
          } else {
            initialFocus.current = "first";
            setOpen(true);
          }
        }}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Račun"
        className="flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 hover:bg-surface-2 aria-expanded:bg-surface-2"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-label font-semibold text-ink ring-1 ring-border-strong"
          >
            {initialFrom(user.name, user.email)}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Račun"
          onKeyDown={onMenuKeyDown}
          // Desni rub menija poravnat s desnim rubom avatara (okidač je 44px, avatar 32px).
          className="animate-pop-in absolute right-1.5 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] origin-top-right rounded-surface border border-border-strong bg-surface-1 p-1.5 shadow-overlay"
        >
          {(user.name || user.email) && (
            <div className="min-w-0 px-3 py-2.5">
              {user.name && <p className="truncate text-label font-semibold text-ink">{user.name}</p>}
              {user.email && <p className="truncate text-label text-ink-muted">{user.email}</p>}
            </div>
          )}

          <Separator />

          <Link href="/settings" role="menuitem" tabIndex={-1} onClick={() => close(false)} className={ITEM}>
            Postavke
          </Link>
          <Link href="/onboarding" role="menuitem" tabIndex={-1} onClick={() => close(false)} className={ITEM}>
            Uredi odabir trgovina
          </Link>
          <div
            role="menuitem"
            tabIndex={-1}
            aria-disabled="true"
            className={`${ITEM} cursor-default text-ink-muted hover:bg-transparent`}
          >
            Profil
            <Badge>uskoro</Badge>
          </div>

          <Separator />

          <div role="group" aria-labelledby={themeLabelId} className="px-1.5 py-1">
            <p id={themeLabelId} className="px-1.5 pb-1.5 text-micro font-semibold text-ink-muted uppercase">
              Izgled
            </p>
            <div className="grid grid-cols-3 gap-0.5 rounded-control border border-border bg-surface-2 p-0.5">
              {THEME_OPTIONS.map((opt) => {
                const checked = pref === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    tabIndex={-1}
                    // Meni ostaje otvoren: promjena teme se odmah vidi iza njega.
                    onClick={() => select(opt.value)}
                    className={`min-h-11 rounded-[0.5rem] px-2 text-label font-semibold transition-[background-color,color,box-shadow] duration-150 focus-visible:-outline-offset-2 ${
                      checked
                        ? "bg-surface-1 text-ink shadow-raised ring-1 ring-border-strong"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <button type="button" role="menuitem" tabIndex={-1} onClick={handleLogout} className={ITEM}>
            Odjava
          </button>
        </div>
      )}
    </div>
  );
}
