"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_OPTIONS, type StoreKey } from "@/config/store-options";
import { getBranches } from "@/lib/price-fetch/branches";

export async function saveStoreSelection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The "Welcome" screen is only for the first completion - later store
  // changes go straight back into the app.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();
  const isFirstTime = !profile?.onboarding_completed;

  const selected = STORE_OPTIONS.filter(
    (s) => s.available && formData.get(s.key) === "on"
  ).map((s) => s.key as StoreKey);

  if (selected.length === 0) {
    redirect("/onboarding?error=empty");
  }

  // Cijene ovise o poslovnici, pa je za svaku odabranu trgovinu obavezan i
  // odabir poslovnice. Ako javni popis poslovnica trenutno nije dostupan,
  // korisnika ne blokiramo - poslovnica ostaje prazna i može se dodati kasnije.
  const rows: {
    user_id: string;
    store_key: StoreKey;
    enabled: boolean;
    branch_key: string | null;
    branch_label: string | null;
  }[] = [];
  for (const store_key of selected) {
    const branches = await getBranches(store_key);
    let branch: { key: string; label: string } | null = null;
    if (branches.length > 0) {
      const chosen = formData.get(`branch_${store_key}`);
      branch = branches.find((b) => b.key === chosen) ?? null;
      if (!branch) {
        redirect("/onboarding?error=branch");
      }
    }
    rows.push({
      user_id: user.id,
      store_key,
      enabled: true,
      branch_key: branch?.key ?? null,
      branch_label: branch?.label ?? null,
    });
  }

  const { error: deleteError } = await supabase.from("user_stores").delete().eq("user_id", user.id);
  if (deleteError) {
    redirect("/onboarding?error=save");
  }

  const { error: insertError } = await supabase.from("user_stores").insert(rows);

  if (insertError) {
    redirect("/onboarding?error=save");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (profileError) {
    redirect("/onboarding?error=save");
  }

  redirect(isFirstTime ? "/onboarding/done" : "/recepti");
}
