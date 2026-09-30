import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export const metadata: Metadata = { title: "Postavke" };

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-6 first:pt-0 last:border-b-0">
      <h2 className="text-sm font-semibold tracking-tight text-ink-muted uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Postavke</h1>

      <div className="mt-4">
        <SettingsSection title="Račun">
          <p className="text-base text-ink">{user.email}</p>
          <p className="mt-1 text-sm text-ink-muted">Prijava putem Googlea.</p>
        </SettingsSection>

        <SettingsSection title="Izgled">
          <ThemeSwitcher />
        </SettingsSection>

        <SettingsSection title="Podaci">
          <Link
            href="/onboarding"
            className="font-semibold text-accent-fg underline underline-offset-2"
          >
            Uredi odabir trgovina
          </Link>
        </SettingsSection>

        <SettingsSection title="O aplikaciji">
          <p className="text-sm text-ink-muted">Verzija: MVP</p>
          <Link
            href="/recepti"
            className="mt-3 inline-block font-semibold text-accent-fg underline underline-offset-2"
          >
            Natrag na recepte
          </Link>
        </SettingsSection>
      </div>
    </div>
  );
}
