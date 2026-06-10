import type { PriceItem } from "@prisma/client";

/**
 * Fuzzy-match an AI-suggested line item description against the user's price
 * book using a Dice coefficient over character bigrams of normalized text.
 * Returns the best item above the threshold, or null (manual pricing).
 */
const MATCH_THRESHOLD = 0.45;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const grams = new Map<string, number>();
  const padded = ` ${s} `;
  for (let i = 0; i < padded.length - 1; i++) {
    const g = padded.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ga = bigrams(na);
  const gb = bigrams(nb);
  let overlap = 0;
  let totalA = 0;
  let totalB = 0;
  for (const [g, c] of ga) {
    totalA += c;
    overlap += Math.min(c, gb.get(g) ?? 0);
  }
  for (const [, c] of gb) totalB += c;
  const dice = (2 * overlap) / (totalA + totalB);

  // Bonus for shared whole words (e.g. "fence post" vs "wood fence post set")
  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w) && w.length > 2) shared++;
  const wordBonus = shared / Math.max(wordsA.size, wordsB.size);

  return Math.min(1, dice * 0.7 + wordBonus * 0.5);
}

export function matchPriceItem(
  description: string,
  priceItems: PriceItem[]
): { item: PriceItem; score: number } | null {
  let best: { item: PriceItem; score: number } | null = null;
  for (const item of priceItems) {
    if (!item.active) continue;
    const score = similarity(description, item.name);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { item, score };
    }
  }
  return best;
}
