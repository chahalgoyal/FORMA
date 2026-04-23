// ──────────────────────────────────────────────
// Forma — Layer 2: Fuzzy Matcher (Fuse.js)
// ──────────────────────────────────────────────

import Fuse from 'fuse.js';
import type { MatchResult, ProfileKeyPath } from '../../types/index.js';
import { STATIC_MAPPINGS } from '../../utils/constants.js';
import { parseConstraints } from '../parser/constraintParser.js';
import { tokenizeAndClean } from '../../utils/helpers.js';

interface FuseEntry {
  patternBoW: string;
  patternTokens: string[];
  profileKey: ProfileKeyPath;
}

// ── Poison words: if label contains ANY of these, skip entirely ──
// These always indicate someone ELSE's data, not the user's.
const POISON_WORDS = new Set([
  'father', 'mother', 'guardian', 'parent', 'spouse',
  'emergency', 'manager', 'referral', 'hr', 'supervisor',
  'company', 'organization', 'employer', 'team', 'event',
  'project', 'mentor', 'friend', 'sibling',
]);

// Build the flattened pattern list using BoW
const flattenedPatterns: FuseEntry[] = STATIC_MAPPINGS.flatMap((mapping) =>
  mapping.patterns.map((pattern) => {
    const tokens = tokenizeAndClean(pattern);
    return {
      patternBoW: tokens.join(' '),
      patternTokens: tokens,
      profileKey: mapping.key,
    };
  })
).filter(entry => entry.patternBoW.length > 0); // Remove empty patterns

export function fuzzyMatch(
  normalizedLabel: string,
  rawLabel: string,
  threshold: number = 0.35 // User can still configure this
): MatchResult | null {
  const labelTokens = tokenizeAndClean(normalizedLabel);
  const labelBoW = labelTokens.join(' ');

  if (!labelBoW) return null;

  // ── Guard 1: Single-token labels must match via keyword only ──
  // A single word like "city", "state", "country" is too ambiguous
  // for fuzzy matching. If keyword Layer 1 didn't catch it, skip.
  if (labelTokens.length <= 1) return null;

  // ── Guard 2: Poison word check ──
  // If ANY label token is a possessive/relational word, bail out.
  for (const token of labelTokens) {
    // Strip trailing "'s" for possessives (e.g., "father's" → "father")
    const base = token.replace(/s$/, '');
    if (POISON_WORDS.has(token) || POISON_WORDS.has(base)) return null;
  }

  const fuse = new Fuse(flattenedPatterns, {
    keys: ['patternBoW'],
    threshold,
    ignoreLocation: true,
    includeScore: true,
    useExtendedSearch: false,
  });

  const results = fuse.search(labelBoW);

  if (results.length === 0 || results[0].score === undefined || results[0].score >= threshold) {
    return null;
  }

  const best = results[0];

  // ── Guard 3: Token overlap validation ──
  // Verify that the label's tokens are actually related to the pattern.
  // A token is "related" if it exactly matches OR shares a 3+ char prefix
  // with any pattern token (handles typos like "prmary" → "primary").
  // If more than half the label tokens are completely unrelated, reject.
  const patternTokens = best.item.patternTokens;

  function isTokenRelated(labelToken: string): boolean {
    for (const pt of patternTokens) {
      if (labelToken === pt) return true;
      // Check if they share a common prefix of at least 2 chars
      const minLen = Math.min(labelToken.length, pt.length);
      if (minLen >= 2) {
        let shared = 0;
        for (let i = 0; i < minLen; i++) {
          if (labelToken[i] === pt[i]) shared++;
          else break;
        }
        if (shared >= 2) return true;
      }
    }
    return false;
  }

  const relatedCount = labelTokens.filter(isTokenRelated).length;
  const relatedRatio = relatedCount / labelTokens.length;

  // If half or fewer of the label tokens relate to the pattern, reject
  if (relatedRatio <= 0.5) return null;

  const constraint = parseConstraints(rawLabel);

  return {
    profileKey: best.item.profileKey,
    score: best.score ?? 0,
    source: 'fuzzy',
    constraint: constraint ?? undefined,
  };
}

