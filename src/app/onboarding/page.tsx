import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_OPTIONS } from "@/config/store-options";
import { getBranches } from "@/lib/price-fetch/branches";
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
    .select("store_key, branch_key")
    .eq("user_id", user.id)
    .eq("enabled", true);

  const selectedKeys = (existing ?? []).map((r) => r.store_key);
  const initialBranches = Object.fromEntries(
    (existing ?? []).flatMap((r) => (r.branch_key ? [[r.store_key, r.branch_key]] : [])),
  );

  const branchLists = await Promise.all(
    STORE_OPTIONS.map(async (s) => [s.key, s.available ? await getBranches(s.key) : []] as const),
  );
  const branchesByStore = Object.fromEntries(branchLists);

  return (
    <div className="mx-auto max-w-md">
      <p className="text-micro font-semibold uppercase tracking-wide text-accent-fg">Još samo jedan korak</p>
      <h1 className="mt-2 text-title text-ink">U kojim trgovinama kupuješ?</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
        Košarica će uspoređivati cijene samo za trgovine koje ovdje odabereš. Cijene se razlikuju od poslovnice do
        poslovnice, pa uz svaku trgovinu odaberi i poslovnicu u kojoj najčešće kupuješ. Odabir kasnije možeš promijeniti
        na ovoj istoj stranici.
      </p>

      {error && (
        <p className="mt-4 rounded-control bg-warn-bg px-3 py-2 text-label text-warn">
          {error === "empty"
            ? "Odaberi barem jednu trgovinu."
            : error === "branch"
              ? "Odaberi poslovnicu za svaku odabranu trgovinu."
              : "Nešto je pošlo po zlu, pokušaj ponovno."}
        </p>
      )}

      <StoreOnboardingForm
        options={STORE_OPTIONS}
        initialSelected={selectedKeys}
        branchesByStore={branchesByStore}
        initialBranches={initialBranches}
        action={saveStoreSelection}
      />
    </div>
  );
}
