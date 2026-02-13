import OpenAI from "openai";

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set (or is empty)");
  }

  // Create a fresh client each time - don't cache
  // This ensures we always use the latest env var
  return new OpenAI({
    apiKey: apiKey,
    timeout: 60000,
    maxRetries: 2,
  });
}

// For backward compatibility if needed
export const openai = {
  chat: {
    completions: {
      create: (params: any) => getOpenAIClient().chat.completions.create(params),
    },
  },
} as any;

