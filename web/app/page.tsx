export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0f1e] px-6 text-center text-slate-200">
      <h1 className="text-4xl font-semibold tracking-tight">📈 Quant AI</h1>
      <p className="max-w-md text-lg text-slate-400">
        Claude-powered quantitative analysis — US equities &amp; options, with a
        portfolio-aware agent. Rebuilding on Next.js + Vercel.
      </p>
      <p className="mt-4 text-sm text-slate-500">Sign-in coming next.</p>
    </main>
  );
}
