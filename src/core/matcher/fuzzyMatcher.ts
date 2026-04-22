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
  profileKey: ProfileKeyPath;
}

// Build the flattened pattern list using BoW
const flattenedPatterns: FuseEntry[] = STATIC_MAPPINGS.flatMap((mapping) =>
  mapping.patterns.map((pattern) => ({
    patternBoW: tokenizeAndClean(pattern).join(' '),
    profileKey: mapping.key,
  }))
).filter(entry => entry.patternBoW.length > 0); // Remove empty patterns

export function fuzzyMatch(
  normalizedLabel: string,
  rawLabel: string,
  threshold: number = 0.35 // User can still configure this
): MatchResult | null {
  const labelBoW = tokenizeAndClean(normalizedLabel).join(' ');

  if (!labelBoW) return null;

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
  const constraint = parseConstraints(rawLabel);

  return {
    profileKey: best.item.profileKey,
    score: best.score ?? 0,
    source: 'fuzzy',
    constraint: constraint ?? undefined,
  };
}
