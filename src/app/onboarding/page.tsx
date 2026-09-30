import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_OPTIONS } from "@/config/store-options";
import { StoreOnboardingForm } from "./StoreOnboardingForm";
import { saveStoreSelection } from "./actions";

export const metadata: Metadata = { title: "Odaberi trgovine" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existing } = await supabase
    .from("user_stores")
    .select("store_key")
    .eq("user_id", user.id)
    .eq("enabled", true);

  const selectedKeys = (existing ?? []).map((r) => r.store_key);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-title text-ink">U kojim trgovinama kupuješ?</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
        Košarica će uspoređivati cijene samo za trgovine koje ovdje odabereš. Odabir kasnije možeš
        promijeniti na ovoj istoj stranici.
      </p>

      {error && (
        <p className="mt-4 rounded-control bg-warn-bg px-3 py-2 text-label text-warn">
          {error === "empty" ? "Odaberi barem jednu trgovinu." : "Nešto je pošlo po zlu, pokušaj ponovno."}
        </p>
      )}

      <StoreOnboardingForm options={STORE_OPTIONS} initialSelected={selectedKeys} action={saveStoreSelection} />
    </div>
  );
}
