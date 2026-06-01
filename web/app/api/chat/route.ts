import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

import { buildTools } from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import { polygon } from "@/lib/market/polygon";
import { createClient } from "@/lib/supabase/server";
import { listTransactions } from "@/lib/transactions";

// The agentic tool-use loop can take a while; give it room (Fluid Compute).
export const maxDuration = 60;

export async function POST(req: Request) {
  // user_id is derived from the session and never trusted from the client.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const tools = buildTools({
    market: polygon,
    // Session-scoped reader — RLS returns only this user's rows.
    listTransactions: () => listTransactions(supabase),
  });

  const result = streamText({
    model: anthropic("claude-opus-4-8"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
