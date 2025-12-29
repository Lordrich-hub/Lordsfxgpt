import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60000,
      maxRetries: 2,
    });
  }

  return cachedClient;
}

// For backward compatibility
export const openai = new Proxy({} as OpenAI, {
  get: (target, prop) => {
    return Reflect.get(getOpenAIClient(), prop);
  },
});

