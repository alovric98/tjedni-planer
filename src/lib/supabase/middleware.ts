import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

// Dev-only prekidač za zaobilaženje logina dok se testira lokalno bez
// stvarnog Google OAuth-a u Supabaseu. NIKAD postaviti na "true" u
// Production env varijablama na Vercelu.
const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";

// Rute dostupne bez prijave - login ekran, OAuth povratni URL, i cron
// endpointi koje zove Vercel Cron (ne prijavljeni korisnik, štite se
// vlastitim CRON_SECRET headerom u api/cron rutama).
const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/cron"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Supabase stores the session in "sb-<ref>-auth-token" (or ".0", ".1" when the
// cookie is chunked).
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (AUTH_DISABLED) return response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() (ne getSession()) - provjerava JWT kod Supabase Auth servera,
  // ne samo dešifrira kolačić, pa se ne može zaobići lažnim/isteklim
  // kolačićem.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    if (isPublicPath(pathname)) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    // A session cookie exists but is no longer valid -> expired session (not
    // a first visit), so the login screen shows "session expired" instead of
    // the welcome copy.
    if (hasAuthCookie(request)) loginUrl.searchParams.set("expired", "1");
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/recepti";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  if (pathname !== "/onboarding" && !isPublicPath(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && !profile.onboarding_completed) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      onboardingUrl.search = "";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return response;
}
