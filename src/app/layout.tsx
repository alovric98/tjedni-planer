import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TabNav } from "@/components/TabNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html
      lang="hr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream text-ink">
        <TabNav />
        <main className="flex-1 p-4 pb-28 sm:pb-4">{children}</main>
      </body>
    </html>
  );
}
