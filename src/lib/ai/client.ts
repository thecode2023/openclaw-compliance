import { GoogleGenerativeAI } from "@google/generative-ai";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

/**
 * Call Gemini with exponential backoff retry logic.
 * Returns the parsed JSON response or throws on permanent failure.
 */
export async function callGeminiWithRetry(
  prompt: string,
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await geminiModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on client errors (bad request, auth issues)
      if (
        lastError.message.includes("400") ||
        lastError.message.includes("401") ||
        lastError.message.includes("403")
      ) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Gemini API call failed after retries");
}
