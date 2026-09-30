"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { showToast } from "@/components/Toast";
import { readFlag, setFlag, WELCOMED_FLAG } from "@/lib/session-flags";

// Screens where the greeting makes no sense: the user is signing in or still
// onboarding (a new user gets "Welcome", not "welcome back").
const SKIP_PREFIXES = ["/login", "/onboarding"];

/** Discreet "welcome back" toast - at most once per browser session. */
export function WelcomeBack({ name }: { name: string | null }) {
  const pathname = usePathname();
  const skip = SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (skip || readFlag(WELCOMED_FLAG)) return;
    setFlag(WELCOMED_FLAG);
    // Short delay so the toast does not pop in during the first page render.
    const timer = setTimeout(() => showToast(name ? `Dobrodošao natrag, ${name}` : "Dobrodošao natrag"), 500);
    return () => clearTimeout(timer);
  }, [skip, name]);

  return null;
}
