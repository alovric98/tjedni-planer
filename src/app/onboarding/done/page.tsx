import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { firstName } from "@/lib/format";
import { WelcomeRedirect } from "./WelcomeRedirect";

export const metadata: Metadata = { title: "Dobrodošao" };

export default async function OnboardingDonePage() {
  const { user } = await requireUser();
  const name = firstName(user.user_metadata?.full_name as string | undefined);

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center text-center">
      <WelcomeRedirect to="/recepti" name={name} />
    </div>
  );
}
