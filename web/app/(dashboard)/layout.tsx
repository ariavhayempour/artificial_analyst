import { redirect } from "next/navigation";

import { signOutAction } from "@/app/auth/actions";
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

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <span className="text-lg font-semibold tracking-tight">📈 Quant AI</span>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span>{user.email}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:bg-slate-800"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
