"use client";

import { useEffect, useState } from "react";
import { setFlag, RELOGIN_FLAG } from "@/lib/session-flags";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.84Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.11Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.6l4.01 3.11C6.23 6.87 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function LoginButton({ next, expired }: { next?: string; expired?: boolean }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mark that we are returning after an expired session - RecipeForm only
  // restores an unsaved draft in that case (see session-flags).
  useEffect(() => {
    if (!expired) return;
    setFlag(RELOGIN_FLAG);
  }, [expired]);

  async function handleClick() {
    setError(null);
    setIsPending(true);
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (next) callbackUrl.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error) {
      setError("Prijava nije uspjela. Pokušaj ponovno.");
      setIsPending(false);
    }
  }

  return (
    <div>
      <Button onClick={handleClick} loading={isPending} size="lg" fullWidth>
        {!isPending && <GoogleIcon />}
        {isPending ? "Otvaram Google…" : expired ? "Prijavi se ponovno" : "Nastavi s Google"}
      </Button>
      {error && (
        <p className="mt-3 rounded-control bg-warn-bg px-3 py-2 text-label text-warn">{error}</p>
      )}
    </div>
  );
}
