// ──────────────────────────────────────────────
// Forma — Layer 1: Keyword Matcher
// Substring-based matching against static mappings
// ──────────────────────────────────────────────

import type { MatchResult } from '../../types/index.js';
import { STATIC_MAPPINGS } from '../../utils/constants.js';
import { parseConstraints } from '../parser/constraintParser.js';
import { tokenizeAndClean } from '../../utils/helpers.js';

/**
 * Layer 1: Strict Bag of Words Matching.
 *
 * Preprocesses the label into a sorted array of semantic tokens.
 * Preprocesses each static pattern similarly.
 * Matches ONLY if the token sets are exactly identical.
 *
 * @param normalizedLabel - The lowercase, trimmed label
 * @param rawLabel        - The original label text (for constraint parsing)
 * @returns MatchResult with score 0 and source "keyword", or null
 */
export function keywordMatch(
  normalizedLabel: string,
  rawLabel: string
): MatchResult | null {
  const labelTokens = tokenizeAndClean(normalizedLabel);
  const labelBoW = labelTokens.join(' ');

  for (const mapping of STATIC_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      const patternTokens = tokenizeAndClean(pattern);
      const patternBoW = patternTokens.join(' ');

      if (labelBoW === patternBoW) {
        // Exact semantic match found
        const constraint = parseConstraints(rawLabel);

        // If we detected a constraint, adjust the key if needed
        let key = mapping.key;

        if (constraint === 'use-college-email' && key === 'contact.email.personal') {
          key = 'contact.email.college';
        } else if (constraint === 'use-personal-email' && key === 'contact.email.college') {
          key = 'contact.email.personal';
        }

        return {
          profileKey: key,
          score: 0,
          source: 'keyword',
          constraint: constraint ?? undefined,
        };
      }
    }
  }

  return null;
}
