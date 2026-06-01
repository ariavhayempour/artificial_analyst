import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-bg px-6 py-10 text-ink">
      <div className="boot-sweep w-full max-w-md">
        {/* Brand boot header */}
        <div className="boot mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-sm border border-amber/50 text-xl text-amber glow-amber">
            ◈
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-[0.2em] text-ink">
              QUANT<span className="text-amber">{"//AI"}</span>
            </h1>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-ink-faint">
              Trading Desk Terminal
            </p>
          </div>
        </div>

        {/* Boot log flavor */}
        <div
          className="boot mb-5 rounded-sm border border-line bg-panel/50 p-3 font-mono text-[0.7rem] leading-relaxed text-ink-faint"
          style={{ animationDelay: "80ms" }}
        >
          <p>
            <span className="text-pos">✓</span> market data feed ……… online
          </p>
          <p>
            <span className="text-pos">✓</span> analyst engine ………… ready
          </p>
          <p>
            <span className="text-amber">›</span> authentication required
            <span className="caret" aria-hidden />
          </p>
        </div>

        <div className="boot" style={{ animationDelay: "140ms" }}>
          <LoginForm />
        </div>
      </div>

      <div className="crt-overlay" aria-hidden />
    </main>
  );
}
