import { afterEach, describe, expect, it, vi } from "vitest";
import { getAgentModel } from "./model";

describe("getAgentModel", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults to anthropic model when MODEL_PROVIDER is unset", () => {
    delete process.env.MODEL_PROVIDER;
    const model = getAgentModel();
    expect(model).toBeDefined();
    expect(model.provider).toContain("anthropic");
  });

  it("returns google model when MODEL_PROVIDER=google", () => {
    process.env.MODEL_PROVIDER = "google";
    const model = getAgentModel();
    expect(model).toBeDefined();
    expect(model.provider).toContain("google");
  });

  it("returns google model when MODEL_PROVIDER=gemini", () => {
    process.env.MODEL_PROVIDER = "gemini";
    const model = getAgentModel();
    expect(model).toBeDefined();
    expect(model.provider).toContain("google");
  });

  it("returns ollama model when MODEL_PROVIDER=ollama", () => {
    process.env.MODEL_PROVIDER = "ollama";
    const model = getAgentModel();
    expect(model).toBeDefined();
    expect(model.provider).toContain("ollama");
  });
});
