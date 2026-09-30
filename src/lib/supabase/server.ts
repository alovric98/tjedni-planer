import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Nedostaju NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env varijable. Vidi .env.example."
  );
}

/**
 * Klijent vezan uz trenutni request (Server Component / Server Action) -
 * nosi korisnikovu sesiju iz kolačića, pa RLS politike (auth.uid()) rade
 * ispravno za tablice profila, odabira trgovina i popisa. Za dijeljene,
 * ne-korisničke podatke (recepti, tjedni plan, cjenik) i dalje se koristi
 * plain klijent iz "@/lib/supabase".
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Pozvano iz Server Componenta bez mogućnosti pisanja kolačića
          // (Next.js ograničenje) - middleware već obnavlja sesiju na
          // svakom requestu, pa je ovo sigurno ignorirati.
        }
      },
    },
  });
}

// Zajednički helper za rute/akcije kojima treba prijavljen korisnik -
// baca ako sesije nema (middleware bi već trebao preusmjeriti na /login
// prije nego se ovo pozove, ovo je druga linija obrane).
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Nisi prijavljen.");
  }
  return { supabase, user };
}
