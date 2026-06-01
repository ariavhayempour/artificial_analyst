"use client";

import type { UIMessage } from "ai";
import { useState } from "react";

import {
  buildTickerPrompt,
  PORTFOLIO_MODES,
  TICKER_MODES,
  type PortfolioMode,
  type TickerMode,
} from "@/lib/agent/prompts";

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

export function ChatPanel({
  messages,
  status,
  onSend,
  onClear,
}: {
  messages: UIMessage[];
  status: string;
  onSend: (text: string) => void;
  onClear: () => void;
}) {
  const [ticker, setTicker] = useState("");
  const [mode, setMode] = useState<TickerMode>("Full breakdown");
  const busy = status === "submitted" || status === "streaming";

  function runTicker() {
    const t = ticker.trim();
    if (t) onSend(buildTickerPrompt(mode, t));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Quick-action console */}
      <div className="panel">
        <div className="panel-head">
          <span className="text-amber">RUN</span>
          <span className="text-ink-dim">Quick Analysis</span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="label">Ticker</span>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="NVDA"
                className="input-term w-36 uppercase"
                onKeyDown={(e) => e.key === "Enter" && runTicker()}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as TickerMode)}
                className="input-term min-w-48"
              >
                {Object.keys(TICKER_MODES).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={runTicker}
              disabled={busy || !ticker.trim()}
              className="btn-term btn-exec h-[2.1rem]"
            >
              ▶ Run
            </button>
          </div>

          <div className="h-px bg-line" />

          <div className="flex flex-wrap items-center gap-2">
            <span className="label mr-1">Portfolio</span>
            {(Object.keys(PORTFOLIO_MODES) as PortfolioMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onSend(PORTFOLIO_MODES[m])}
                disabled={busy}
                className="btn-term"
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              onClick={onClear}
              className="btn-term ml-auto"
              disabled={messages.length === 0}
            >
              ✕ Clear
            </button>
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="rounded-sm border border-dashed border-line bg-panel/40 p-8 text-center">
            <p className="text-sm text-ink-dim">
              <span className="text-amber">▸</span> Analyst standing by.
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Run a quick analysis above, or type a question in the command line
              below.
            </p>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div
              key={m.id}
              className="flex gap-2 px-1 text-sm text-ink-dim"
            >
              <span className="shrink-0 text-amber glow-amber">›</span>
              <span className="whitespace-pre-wrap font-mono">
                {messageText(m)}
              </span>
            </div>
          ) : (
            <div
              key={m.id}
              className="panel overflow-hidden"
            >
              <div className="panel-head">
                <span className="live-dot !size-1.5" aria-hidden />
                <span className="text-amber">ANALYST</span>
              </div>
              <div className="whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed text-ink">
                {messageText(m) || (busy ? "▍" : "")}
              </div>
            </div>
          ),
        )}

        {busy && messages.at(-1)?.role === "user" && (
          <div className="flex items-center gap-2 px-1 text-xs text-ink-faint">
            <span className="live-dot !size-1.5" aria-hidden />
            fetching market data &amp; analyzing
            <span className="caret" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}
