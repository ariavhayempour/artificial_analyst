"use client";

import type { UIMessage } from "ai";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function runTicker() {
    const t = ticker.trim();
    if (t) onSend(buildTickerPrompt(mode, t));
  }

  function submitFreeText(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (text) {
      onSend(text);
      setInput("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <Input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Ticker e.g. NVDA"
            className="w-36"
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as TickerMode)}
            className="h-9 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-200"
          >
            {Object.keys(TICKER_MODES).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Button type="button" onClick={runTicker} disabled={busy || !ticker.trim()}>
            ▶ Run
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PORTFOLIO_MODES) as PortfolioMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSend(PORTFOLIO_MODES[m])}
              disabled={busy}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="ml-auto rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800"
          >
            🗑 Clear
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-slate-500">
            Ask about any stock or options trade, or analyze your portfolio above.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg p-3 ${
              m.role === "user"
                ? "self-end bg-slate-700/60"
                : "bg-slate-900/60 border border-slate-800"
            }`}
          >
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
              {m.role === "user" ? "You" : "Analyst"}
            </div>
            <div className="whitespace-pre-wrap text-sm text-slate-200">
              {messageText(m) || (busy ? "…" : "")}
            </div>
          </div>
        ))}
        {busy && messages.at(-1)?.role === "user" && (
          <div className="text-sm text-slate-500">Fetching market data &amp; analyzing…</div>
        )}
      </div>

      <form onSubmit={submitFreeText} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about any stock or options trade…"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
