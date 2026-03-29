/**
 * Generate a SHA-256 content hash for deduplication.
 * Uses normalized title + source URL as the fingerprint.
 */
export async function computeContentHash(title: string, sourceUrl: string): Promise<string> {
  const input = `${title.toLowerCase().trim()}|${sourceUrl.trim()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
