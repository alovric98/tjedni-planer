"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TOAST_EVENT = "tjedni-planer:toast";

const TOAST_MESSAGES: Record<string, string> = {
  recipe_created: "Recept spremljen.",
  recipe_updated: "Izmjene spremljene.",
};

type ToastState = { message: string; tone: "info" | "error" };

/**
 * Prikaži toast iz bilo koje klijentske komponente (npr. nakon uspješne server
 * akcije). `error` ton se objavljuje čitaču zaslona odmah (role="alert").
 */
export function showToast(message: string, tone: ToastState["tone"] = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastState>(TOAST_EVENT, { detail: { message, tone } }));
}

// Server akcije koje rade redirect (npr. spremanje recepta) ne mogu pozvati
// showToast direktno - poruku prenose kroz ?toast=<key> na redirectu, a ovo
// je pokupi na sljedećoj stranici i očisti iz URL-a.
function ToastFromQuery({ onToast }: { onToast: (toast: ToastState) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toastKey = searchParams.get("toast");

  useEffect(() => {
    if (!toastKey) return;
    const message = TOAST_MESSAGES[toastKey];
    if (message) onToast({ message, tone: "info" });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("toast");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [toastKey, onToast, pathname, router, searchParams]);

  return null;
}

/** Mount jednom u root layoutu. */
export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    function onToast(e: Event) {
      setToast((e as CustomEvent<ToastState>).detail);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.tone === "error" ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <Suspense fallback={null}>
        <ToastFromQuery onToast={setToast} />
      </Suspense>
      {toast && (
        <div
          role={toast.tone === "error" ? "alert" : "status"}
          // Iznad mobilnog nav-a (--nav-offset), na desktopu dolje u sredini.
          className="animate-toast-in fixed inset-x-4 bottom-[calc(var(--nav-offset)+0.75rem)] z-50 mx-auto flex max-w-md items-center justify-center gap-2.5 rounded-surface border border-border-strong bg-surface-1 px-4 py-3 text-label font-semibold text-ink shadow-overlay sm:bottom-6 sm:w-fit sm:max-w-lg"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${toast.tone === "error" ? "bg-warn" : "bg-accent-fg"}`}
          />
          {toast.message}
        </div>
      )}
    </>
  );
}
