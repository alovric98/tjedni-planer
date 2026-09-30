import type { ReactNode } from "react";

// Širina sadržaja Košarice - drži se u route layoutu da page.tsx ostane netaknut.
export default function KosaricaLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl">{children}</div>;
}
