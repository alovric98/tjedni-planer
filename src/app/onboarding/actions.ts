"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORE_OPTIONS, type StoreKey } from "@/config/store-options";

export async function saveStoreSelection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const selected = STORE_OPTIONS.filter(
    (s) => s.available && formData.get(s.key) === "on"
  ).map((s) => s.key as StoreKey);

  if (selected.length === 0) {
    redirect("/onboarding?error=empty");
  }

  const { error: deleteError } = await supabase.from("user_stores").delete().eq("user_id", user.id);
  if (deleteError) {
    redirect("/onboarding?error=save");
  }

  const { error: insertError } = await supabase
    .from("user_stores")
    .insert(selected.map((store_key) => ({ user_id: user.id, store_key, enabled: true })));

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

  redirect("/recepti");
}
