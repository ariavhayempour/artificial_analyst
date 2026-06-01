import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0f1e] px-6 text-slate-200">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">📈 Quant AI</h1>
        <p className="mt-1 text-sm text-slate-400">Sign in to your trading terminal</p>
      </div>
      <LoginForm />
    </main>
  );
}
