import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { TabNav } from "@/components/TabNav";
import "./globals.css";

// Dizajn-direkcija (Zara): IBM Plex Sans, jedna obitelj, Medium/SemiBold za
// naslove i cijene, Regular za tijelo teksta. latin-ext je obavezan jer je
// sučelje na hrvatskom (č/ć/š/ž/đ).
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Tjedni planer ručkova",
    template: "%s · Tjedni planer",
  },
  description: "Planiranje ručkova i usporedba cijena Lidl vs Kaufland",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hr" className={`${plexSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <TabNav />
        <main className="flex-1 p-4 pb-28 sm:pb-4">{children}</main>
      </body>
    </html>
  );
}
