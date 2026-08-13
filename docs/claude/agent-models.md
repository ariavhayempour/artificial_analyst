# Agent Model Selection

## Language Model Resolution

The `getAgentModel` function in `web/lib/agent/model.ts` resolves the Vercel AI SDK language model for agent execution based on environment configuration.

- `MODEL_PROVIDER`: Determines model provider (`anthropic` default, `google` / `gemini`, `ollama`).
- `ANTHROPIC_MODEL`: Model identifier for Anthropic (defaults to `claude-opus-4-8`).
- `GEMINI_MODEL`: Model identifier for Google Gemini (defaults to `gemini-2.5-flash`).
- `OLLAMA_MODEL`: Model identifier for local Ollama (defaults to `llama3.1`).
- `OLLAMA_BASE_URL`: Endpoint for local Ollama instance (defaults to `http://127.0.0.1:11434/api`).
