"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TOAST_EVENT = "tjedni-planer:toast";

const TOAST_MESSAGES: Record<string, string> = {
  recipe_created: "Recept spremljen.",
  recipe_updated: "Izmjene spremljene.",
};

/** Prikaži toast iz bilo koje klijentske komponente (npr. nakon uspješne server akcije). */
export function showToast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

// Server akcije koje rade redirect (npr. spremanje recepta) ne mogu pozvati
// showToast direktno - poruku prenose kroz ?toast=<key> na redirectu, a ovo
// je pokupi na sljedećoj stranici i očisti iz URL-a.
function ToastFromQuery({ onToast }: { onToast: (message: string) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toastKey = searchParams.get("toast");

  useEffect(() => {
    if (!toastKey) return;
    const message = TOAST_MESSAGES[toastKey];
    if (message) onToast(message);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("toast");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [toastKey, onToast, pathname, router, searchParams]);

  return null;
}

/** Mount jednom u root layoutu. */
export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function onToast(e: Event) {
      setMessage((e as CustomEvent<string>).detail);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <>
      <Suspense fallback={null}>
        <ToastFromQuery onToast={setMessage} />
      </Suspense>
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-40 rounded-xl border border-border bg-surface-1 px-4 py-3 text-center text-sm font-semibold text-ink shadow-[0_-2px_12px_rgba(27,36,32,0.10)] sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:w-auto sm:-translate-x-1/2"
        >
          {message}
        </div>
      )}
    </>
  );
}
