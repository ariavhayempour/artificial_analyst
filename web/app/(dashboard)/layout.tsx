import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Auth-gated and per-user: never statically prerendered.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: the proxy already gates protected paths, but the layout
  // re-checks so a Server Component never renders for an unauthenticated user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The terminal shell (command rail, status bar, command line) is rendered by
  // the client dashboard so it can share live chat + view state. The layout
  // just provides the screen, the CRT atmosphere, and the auth gate.
  return (
    <div className="relative min-h-screen bg-bg text-ink">
      {children}
      <div className="crt-overlay" aria-hidden />
    </div>
  );
}
