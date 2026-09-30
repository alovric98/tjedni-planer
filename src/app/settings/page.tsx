import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export const metadata: Metadata = { title: "Postavke" };

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-7 first:pt-0 last:border-b-0">
      <h2 className="text-micro font-semibold text-ink-subtle uppercase">{title}</h2>
      <div className="mt-4">{children}</div>
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
      <h1 className="text-title text-ink">Postavke</h1>

      <div className="mt-4">
        <SettingsSection title="Račun">
          <p className="text-[0.9375rem] font-medium text-ink">{user.email}</p>
          <p className="mt-1 text-label text-ink-muted">Prijava putem Googlea.</p>
        </SettingsSection>

        <SettingsSection title="Izgled">
          <ThemeSwitcher />
        </SettingsSection>

        <SettingsSection title="Podaci">
          <Link
            href="/onboarding"
            className="text-label font-semibold text-accent-fg underline underline-offset-4 transition-colors duration-150 hover:text-ink"
          >
            Uredi odabir trgovina
          </Link>
        </SettingsSection>

        <SettingsSection title="O aplikaciji">
          <p className="text-label text-ink-muted">Verzija: MVP</p>
          <Link
            href="/recepti"
            className="mt-3 inline-block text-label font-semibold text-accent-fg underline underline-offset-4 transition-colors duration-150 hover:text-ink"
          >
            Natrag na recepte
          </Link>
        </SettingsSection>
      </div>
    </div>
  );
}
