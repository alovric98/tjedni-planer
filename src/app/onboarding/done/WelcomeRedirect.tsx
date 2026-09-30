"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { setFlag, WELCOMED_FLAG } from "@/lib/session-flags";

const AUTO_ENTER_MS = 2200;

/** Final onboarding screen: short confirmation, then auto-enter the app. */
export function WelcomeRedirect({ to, name }: { to: string; name: string | null }) {
  const router = useRouter();

  useEffect(() => {
    // Already welcomed - a "welcome back" toast in the app would be redundant.
    setFlag(WELCOMED_FLAG);
    router.prefetch(to);
    const timer = setTimeout(() => router.replace(to), AUTO_ENTER_MS);
    return () => clearTimeout(timer);
  }, [router, to]);

  return (
    <>
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-raised"
      >
        <CheckIcon className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-title text-ink" role="status">
        Dobrodošao u Tjedni Planer{name ? `, ${name}` : ""}
      </h1>
      <p className="mt-3 max-w-xs text-[0.9375rem] leading-relaxed text-ink-muted">
        Sve je spremno. Krenimo s prvim receptom.
      </p>
      <Link href={to} replace className={`${buttonClasses({ size: "lg" })} mt-8`}>
        Uđi u aplikaciju
      </Link>
    </>
  );
}
