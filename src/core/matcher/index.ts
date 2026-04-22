// ──────────────────────────────────────────────
// Forma — Matcher Orchestrator
// Runs all matching layers in sequence
// ──────────────────────────────────────────────

import type { MatchResult, LearnedMapping, FormaSettings } from '../../types/index.js';
import { DEFAULT_SETTINGS } from '../../utils/constants.js';
import { keywordMatch } from './keywordMatcher.js';
import { fuzzyMatch } from './fuzzyMatcher.js';

/**
 * Main matching function. Runs all layers in sequence:
 *
 * Layer 0: Learned mappings (exact label match, highest priority)
 * Layer 1: Strict Bag of Words matching against static mappings
 * Layer 2: Fuzzy matching via Fuse.js (using BoW)
 *
 * Returns the first confident match, or null if no match is found.
 *
 * @param normalizedLabel  - Cleaned label text
 * @param rawLabel         - Original label text (for constraint parsing)
 * @param learnedMappings  - Array of user-confirmed learned mappings
 * @param settings         - Extension settings (for fuzzy threshold)
 */
export function match(
  normalizedLabel: string,
  rawLabel: string,
  learnedMappings: LearnedMapping[] = [],
  settings: FormaSettings = DEFAULT_SETTINGS
): MatchResult | null {
  // ── Layer 0: Learned Mappings ──
  // Exact match on normalized label. Highest priority.
  const learned = learnedMappings.find(
    (m) => m.normalizedLabel === normalizedLabel
  );

  if (learned) {
    console.debug(
      `[Forma] "${rawLabel}" → learned mapping → "${learned.profileKey}"`
    );
    return {
      profileKey: learned.profileKey,
      score: 0,
      source: 'learned',
    };
  }

  // ── Layer 1: Strict Bag of Words Matching ──
  const keywordResult = keywordMatch(normalizedLabel, rawLabel);
  if (keywordResult) {
    console.debug(
      `[Forma] "${rawLabel}" → keyword match → "${keywordResult.profileKey}" (score: 0)`
    );
    return keywordResult;
  }

  // ── Layer 2: Fuzzy Matching ──
  const fuzzyResult = fuzzyMatch(normalizedLabel, rawLabel, settings.fuseThreshold);
  if (fuzzyResult) {
    console.debug(
      `[Forma] "${rawLabel}" → fuzzy match → "${fuzzyResult.profileKey}" (score: ${fuzzyResult.score.toFixed(3)})`
    );
    return fuzzyResult;
  }

  // ── No Match ──
  console.debug(`[Forma] "${rawLabel}" → no match found`);
  return null;
}
