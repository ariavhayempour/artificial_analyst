"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

import { AddTransactionForm } from "@/components/add-transaction-form";
import { ChatPanel } from "@/components/chat-panel";
import { HoldingsTable } from "@/components/holdings-table";
import { RealizedTable } from "@/components/realized-table";
import { TradeHistory } from "@/components/trade-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildHoldingPrompt } from "@/lib/agent/prompts";
import type { HoldingRow, Totals } from "@/lib/holdings";
import type { RealizedPnl, Transaction } from "@/lib/portfolio";

export function DashboardClient({
  rows,
  totals,
  realized,
  history,
}: {
  rows: HoldingRow[];
  totals: Totals;
  realized: RealizedPnl;
  history: Transaction[];
}) {
  const [tab, setTab] = useState("positions");
  const { messages, sendMessage, status, setMessages } = useChat();

  // Quick actions and per-holding "Analyze" share one chat: send the prompt and
  // jump to the Chat tab so the streamed answer is visible.
  function sendPrompt(text: string) {
    sendMessage({ text });
    setTab("chat");
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList>
        <TabsTrigger value="positions">📊 Positions</TabsTrigger>
        <TabsTrigger value="realized">💰 Realized</TabsTrigger>
        <TabsTrigger value="chat">💬 Chat</TabsTrigger>
      </TabsList>

      <TabsContent value="positions" className="mt-4">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Add transaction</h2>
            <AddTransactionForm />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Holdings</h2>
            <HoldingsTable
              rows={rows}
              totals={totals}
              onAnalyze={(t) => sendPrompt(buildHoldingPrompt(t))}
            />
          </section>
        </div>
      </TabsContent>

      <TabsContent value="realized" className="mt-4">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Realized gains</h2>
            <RealizedTable realized={realized} />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Trade history</h2>
            <TradeHistory txns={history} />
          </section>
        </div>
      </TabsContent>

      <TabsContent value="chat" className="mt-4">
        <ChatPanel
          messages={messages}
          status={status}
          onSend={sendPrompt}
          onClear={() => setMessages([])}
        />
      </TabsContent>
    </Tabs>
  );
}
