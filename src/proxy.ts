import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 preimenovao je "middleware" konvenciju u "proxy" (isti mehanizam,
// vidi node_modules/next/dist/docs/.../proxy.md) - ovaj file je namjerno
// proxy.ts, ne middleware.ts.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
