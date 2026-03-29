import type { RSSFeedItem } from "./rss";

const AI_KEYWORDS = /\b(artificial intelligence|AI|machine learning|algorithm|automated decision|deepfake|generative ai|large language model|LLM|facial recognition|biometric|autonomous system|chatbot|neural network|data protection|privacy|GDPR|transparency|accountability|governance|ethical ai|responsible ai|model risk)\b/i;

const REG_KEYWORDS = /\b(regulation|legislation|law|act|bill|directive|framework|guideline|standard|ordinance|decree|executive order|compliance|enforcement|penalty|fine|rule|policy|requirement|mandate)\b/i;

/**
 * Quick keyword pre-filter to avoid sending obvious noise to Gemini.
 * Returns true if the item likely relates to AI regulation.
 */
export function isLikelyRelevant(item: RSSFeedItem): boolean {
  const text = `${item.title} ${item.contentSnippet}`;
  return AI_KEYWORDS.test(text) && REG_KEYWORDS.test(text);
}
