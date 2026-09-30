import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { MobileTabBar } from "@/components/TabNav";
import { AppHeader } from "@/components/AppHeader";
import { ToastHost } from "@/components/Toast";
import { WelcomeBack } from "@/components/WelcomeBack";
import { firstName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

// Fraunces (serif) samo za h1/display, Inter za sve ostalo. Oba su variable
// fontovi (bez eksplicitne težine). latin-ext je obavezan jer je sučelje na
// hrvatskom (č/ć/š/ž/đ).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
});

const APP_URL = "https://tjedni-planer.vercel.app";
const APP_DESCRIPTION = "Planiranje ručkova i usporedba cijena Lidl vs Kaufland";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Tjedni planer ručkova",
    template: "%s · Tjedni planer",
  },
  description: APP_DESCRIPTION,
  // Osobna aplikacija bez javnog sadržaja za tražilice (audit N20 - nedostajala
  // robots oznaka na aplikaciji koja upisuje/briše podatke bez logina na
  // starim rutama). noindex ne mijenja pristupačnost ni jednu funkciju, samo
  // isključuje stranice iz Google/Bing indeksa.
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { title: "Tjedni planer", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Tjedni planer ručkova",
    description: APP_DESCRIPTION,
    url: APP_URL,
    siteName: "Tjedni planer",
    locale: "hr_HR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tjedni planer ručkova",
    description: APP_DESCRIPTION,
  },
};

// viewport-fit=cover je preduvjet da env(safe-area-inset-*) (donji nav, toast,
// header) uopće vraća vrijednosti na uređajima s notchom/home indikatorom.
export const viewport: Viewport = { viewportFit: "cover" };

// Primijeni spremljenu temu PRIJE hydrationa da izbjegnemo flash pogrešne
// teme. Čita se izravno iz localStorage (ne iz Reacta) jer server ne zna
// korisnikovu preferenciju ni OS postavku.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="hr" className={`${inter.variable} ${fraunces.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <AppHeader
          user={
            user
              ? {
                  email: user.email ?? null,
                  name: (user.user_metadata?.full_name as string | undefined) ?? null,
                  avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
                }
              : null
          }
        />
        <ToastHost />
        {user && <WelcomeBack name={firstName(user.user_metadata?.full_name as string | undefined)} />}
        <main className="flex-1 px-4 pt-6 pb-[calc(var(--nav-offset)+1.5rem)]">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
        <MobileTabBar />
      </body>
    </html>
  );
}
