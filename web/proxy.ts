import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

// Next 16 renamed the `middleware` convention to `proxy`. This runs before
// routes render: it refreshes the Supabase session and gates protected pages.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
