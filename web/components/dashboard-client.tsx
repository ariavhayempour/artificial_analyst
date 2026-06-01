"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

import { signOutAction } from "@/app/auth/actions";
import { AddTransactionForm } from "@/components/add-transaction-form";
import { ChatPanel } from "@/components/chat-panel";
import { HoldingsTable } from "@/components/holdings-table";
import { RealizedTable } from "@/components/realized-table";
import { TradeHistory } from "@/components/trade-history";
import { buildHoldingPrompt } from "@/lib/agent/prompts";
import type { HoldingRow, Totals } from "@/lib/holdings";
import type { RealizedPnl, Transaction } from "@/lib/portfolio";

type View = "positions" | "realized" | "chat";

const NAV: { id: View; label: string; glyph: string; key: string }[] = [
  { id: "positions", label: "Positions", glyph: "▦", key: "1" },
  { id: "realized", label: "Realized", glyph: "∑", key: "2" },
  { id: "chat", label: "Analyst", glyph: "▸", key: "3" },
];

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DashboardClient({
  rows,
  totals,
  realized,
  history,
  userEmail,
}: {
  rows: HoldingRow[];
  totals: Totals;
  realized: RealizedPnl;
  history: Transaction[];
  userEmail: string;
}) {
  const [view, setView] = useState<View>("positions");
  const [command, setCommand] = useState("");
  const [clock, setClock] = useState<string>("--:--:--");
  const cmdRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage, status, setMessages } = useChat();
  const busy = status === "submitted" || status === "streaming";

  // Live desk clock — client-only to avoid hydration drift.
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // "/" focuses the command line from anywhere outside a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        cmdRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Quick actions, per-holding "Analyze", and the command line all share one
  // chat: dispatch the prompt and jump to the analyst console.
  function sendPrompt(text: string) {
    sendMessage({ text });
    setView("chat");
  }

  function runCommand(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = command.trim();
    if (!text || busy) return;
    sendPrompt(text);
    setCommand("");
  }

  const pnlPositive = totals.unrealized >= 0;
  // Tape source: every priced position with a known move.
  const tape = rows.filter((r) => r.unrealizedPct !== null);

  return (
    <div className="flex min-h-screen boot-sweep">
      {/* ---- Command rail -------------------------------------------------- */}
      <aside className="hidden shrink-0 flex-col border-r border-line bg-panel/60 sm:flex sm:w-[4.75rem] lg:w-56">
        <div className="flex h-12 items-center gap-2 border-b border-line px-3 lg:px-4">
          <span className="grid size-7 place-items-center rounded-sm border border-amber/50 text-amber glow-amber">
            ◈
          </span>
          <span className="hidden text-sm font-semibold tracking-[0.18em] text-ink lg:inline">
            QUANT<span className="text-amber">{"//AI"}</span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                data-active={active}
                className={`group flex items-center gap-3 rounded-sm border-l-2 px-2.5 py-2 text-left transition-all ${
                  active
                    ? "border-amber bg-amber/10 text-amber"
                    : "border-transparent text-ink-faint hover:border-line-bright hover:bg-panel-2 hover:text-ink"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className={`text-base ${active ? "glow-amber" : ""}`}>
                  {item.glyph}
                </span>
                <span className="hidden flex-1 text-xs uppercase tracking-[0.14em] lg:inline">
                  {item.label}
                </span>
                <span className="hidden text-[0.6rem] text-ink-faint lg:inline">
                  {item.key}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <div className="hidden lg:block">
            <div className="label">Book Value</div>
            <div className="mt-0.5 text-sm font-semibold text-ink tnum">
              {money(totals.marketValue)}
            </div>
            <div
              className={`text-[0.7rem] tnum ${pnlPositive ? "text-pos" : "text-neg"}`}
            >
              {pnlPositive ? "▲" : "▼"} {money(totals.unrealized)}
            </div>
          </div>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="btn-term w-full justify-center"
              title={userEmail}
            >
              <span className="lg:hidden">⏻</span>
              <span className="hidden lg:inline">⏻ Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ---- Right column -------------------------------------------------- */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Status bar */}
        <header className="flex h-12 items-center gap-4 border-b border-line bg-panel/50 px-4 backdrop-blur-sm">
          {/* Mobile view switch */}
          <div className="flex items-center gap-2 sm:hidden">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                data-active={view === item.id}
                className="btn-term px-2 py-1"
              >
                {item.glyph}
              </button>
            ))}
          </div>

          <span className="hidden items-center gap-2 sm:flex">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-dim">
              {NAV.find((n) => n.id === view)?.label}
            </span>
          </span>

          {/* Ticker tape */}
          <div className="tape-track relative hidden flex-1 overflow-hidden md:block">
            <div className="tape">
              {[...tape, ...tape].map((r, i) => (
                <span
                  key={`${r.ticker}-${i}`}
                  className="inline-flex items-center gap-1.5 text-xs"
                >
                  <span className="font-semibold text-ink">{r.ticker}</span>
                  <span className="text-ink-faint tnum">
                    {r.price === null ? "—" : r.price.toFixed(2)}
                  </span>
                  <span
                    className={`tnum ${(r.unrealizedPct ?? 0) >= 0 ? "text-pos" : "text-neg"}`}
                  >
                    {(r.unrealizedPct ?? 0) >= 0 ? "▲" : "▼"}
                    {Math.abs(r.unrealizedPct ?? 0).toFixed(2)}%
                  </span>
                </span>
              ))}
              {tape.length === 0 && (
                <span className="text-xs text-ink-faint">
                  NO OPEN POSITIONS — record a buy to start the tape
                </span>
              )}
            </div>
            {/* edge fades */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent" />
          </div>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden items-center gap-2 md:flex">
              <span className="live-dot" aria-hidden />
              <span className="label !text-pos">Live</span>
            </span>
            <span
              className="text-xs text-ink-dim tnum"
              suppressHydrationWarning
            >
              {clock}
            </span>
          </div>
        </header>

        {/* Main view */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {view === "positions" && (
            <div
              className="boot flex flex-col gap-6"
              style={{ animationDelay: "60ms" }}
            >
              <Section title="New Order" code="ORD">
                <AddTransactionForm />
              </Section>
              <Section title="Open Positions" code="POS">
                <HoldingsTable
                  rows={rows}
                  totals={totals}
                  onAnalyze={(t) => sendPrompt(buildHoldingPrompt(t))}
                />
              </Section>
            </div>
          )}

          {view === "realized" && (
            <div
              className="boot flex flex-col gap-6"
              style={{ animationDelay: "60ms" }}
            >
              <Section title="Realized Gains" code="RLZ">
                <RealizedTable realized={realized} />
              </Section>
              <Section title="Trade History" code="LOG">
                <TradeHistory txns={history} />
              </Section>
            </div>
          )}

          {view === "chat" && (
            <div
              className="boot mx-auto max-w-4xl"
              style={{ animationDelay: "60ms" }}
            >
              <ChatPanel
                messages={messages}
                status={status}
                onSend={sendPrompt}
                onClear={() => setMessages([])}
              />
            </div>
          )}
        </main>

        {/* Global command line */}
        <form
          onSubmit={runCommand}
          className="flex items-center gap-2 border-t border-line bg-panel/70 px-4 py-2.5 backdrop-blur-sm"
        >
          <span className="text-amber glow-amber">›</span>
          <input
            ref={cmdRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={busy}
            placeholder="ask the analyst — e.g. is NVDA overextended? · press / to focus"
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-ink-faint disabled:opacity-50"
            aria-label="Ask the analyst"
          />
          {busy ? (
            <span className="label !text-amber">streaming…</span>
          ) : (
            <span className="caret hidden sm:inline" aria-hidden />
          )}
          <button
            type="submit"
            disabled={busy || !command.trim()}
            className="btn-term btn-exec"
          >
            ⏎ Exec
          </button>
        </form>
      </div>
    </div>
  );
}

function Section({
  title,
  code,
  children,
}: {
  title: string;
  code: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="text-amber">{code}</span>
        <span className="text-ink-dim">{title}</span>
        <span className="ml-auto text-ink-faint">◇</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
