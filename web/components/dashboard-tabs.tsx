"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function DashboardTabs({
  positions,
  realized,
  chat,
}: {
  positions: React.ReactNode;
  realized: React.ReactNode;
  chat: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="positions" className="w-full">
      <TabsList>
        <TabsTrigger value="positions">📊 Positions</TabsTrigger>
        <TabsTrigger value="realized">💰 Realized</TabsTrigger>
        <TabsTrigger value="chat">💬 Chat</TabsTrigger>
      </TabsList>
      <TabsContent value="positions" className="mt-4">
        {positions}
      </TabsContent>
      <TabsContent value="realized" className="mt-4">
        {realized}
      </TabsContent>
      <TabsContent value="chat" className="mt-4">
        {chat}
      </TabsContent>
    </Tabs>
  );
}
