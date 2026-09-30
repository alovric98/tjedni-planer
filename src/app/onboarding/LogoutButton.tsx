"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleClick() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleClick} className="text-label font-semibold text-ink-muted underline underline-offset-4 transition-colors duration-150 hover:text-ink">
      Odjava
    </button>
  );
}
