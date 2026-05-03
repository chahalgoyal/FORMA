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
// ── Poison words: labels referencing someone else's data ──
const POISON_WORDS = [
  // Relatives / 3rd Parties
  'father', 'mother', 'guardian', 'parent', 'spouse',
  'emergency', 'manager', 'referral', 'hr', 'supervisor',
  'company', 'organization', 'employer', 'team', 'event',
  'project', 'mentor', 'friend', 'sibling',
  'wife', 'husband', 'nominee', 'referee', 'reference',
  'representative', 'witness', 'interviewer',
  // Locations
  'state', 'city', 'country', 'district', 'pincode', 'zipcode', 'address', 'province', 'region',
  // System / Files
  'captcha', 'password', 'signature',
  'upload', 'file', 'photo', 'image', 'document', 'pdf',
];

export function keywordMatch(
  normalizedLabel: string,
  rawLabel: string
): MatchResult | null {
  // ── Poison word guard ──
  // Check the ORIGINAL normalized label (before tokenization)
  // so possessives like "father's" are caught.
  for (const word of POISON_WORDS) {
    if (normalizedLabel.includes(word)) return null;
  }

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
