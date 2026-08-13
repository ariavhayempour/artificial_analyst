import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOllama } from "ollama-ai-provider";
import type { streamText } from "ai";

type StreamTextModel = Parameters<typeof streamText>[0]["model"];

// Resolves the Vercel AI SDK language model from environment settings.
export function getAgentModel(): StreamTextModel {
  const provider = (process.env.MODEL_PROVIDER || "anthropic").toLowerCase();

  if (provider === "google" || provider === "gemini") {
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    return (google(modelName) as unknown) as StreamTextModel;
  }

  if (provider === "ollama") {
    const baseURL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/api";
    const ollama = createOllama({ baseURL });
    const modelName = process.env.OLLAMA_MODEL || "llama3.1";
    return (ollama(modelName) as unknown) as StreamTextModel;
  }

  const modelName = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  return (anthropic(modelName) as unknown) as StreamTextModel;
}
