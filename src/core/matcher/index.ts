// ──────────────────────────────────────────────
// Forma — Matcher Orchestrator
// Runs all matching layers in sequence
// ──────────────────────────────────────────────

import type { MatchResult, FormaSettings } from '../../types/index.js';
import { DEFAULT_SETTINGS } from '../../utils/constants.js';
import { normalizeLabel } from '../../utils/helpers.js';
import { keywordMatch } from './keywordMatcher.js';
import { fuzzyMatch } from './fuzzyMatcher.js';

/**
 * Runs the full matching pipeline on a single (non-slashed) label.
 * Used internally by the main match() and by slash-split matching.
 */
function matchSingle(
  normalizedLabel: string,
  rawLabel: string,
  settings: FormaSettings
): MatchResult | null {

  // ── Layer 1: Strict Bag of Words Matching ──
  const keywordResult = keywordMatch(normalizedLabel, rawLabel);
  if (keywordResult) return keywordResult;

  // ── Layer 2: Fuzzy Matching ──
  const fuzzyResult = fuzzyMatch(normalizedLabel, rawLabel, settings.fuseThreshold);
  if (fuzzyResult) return fuzzyResult;

  return null;
}

/**
 * Main matching function. Handles slash-split labels, then runs
 * the standard layer pipeline.
 *
 * @param normalizedLabel  - Cleaned label text
 * @param rawLabel         - Original label text (for constraint parsing)
 * @param learnedMappings  - Array of user-confirmed learned mappings
 * @param settings         - Extension settings (for fuzzy threshold)
 */
export function match(
  normalizedLabel: string,
  rawLabel: string,
  settings: FormaSettings = DEFAULT_SETTINGS
): MatchResult | null {

  // ── Pre-check: Slash-split labels ──
  // If label contains "/", split into parts and match each.
  // Fill only if ALL parts resolve to the SAME profile key.
  // More than 2 slashes → too noisy, skip immediately.
  if (rawLabel.includes('/')) {
    const parts = rawLabel.split('/').map(p => p.trim()).filter(p => p.length > 0);

    // More than 3 parts or less than 2 → skip (too complex or malformed)
    if (parts.length < 2 || parts.length > 3) {
      console.debug(`[Forma] "${rawLabel}" → slash-split: ${parts.length} parts, skipping`);
      return null;
    }

    // Match each part independently
    const keys: (string | null)[] = parts.map(part => {
      const norm = normalizeLabel(part);
      const result = matchSingle(norm, part, settings);
      return result?.profileKey ?? null;
    });

    // All parts must resolve to the same non-null key
    const firstKey = keys[0];
    if (firstKey && keys.every(k => k === firstKey)) {
      console.debug(
        `[Forma] "${rawLabel}" → slash-split: all parts → "${firstKey}"`
      );
      // Return using the first part's full match result
      const norm = normalizeLabel(parts[0]);
      return matchSingle(norm, parts[0], settings);
    }

    console.debug(
      `[Forma] "${rawLabel}" → slash-split: keys disagree [${keys.join(', ')}], skipping`
    );
    return null;
  }

  // ── Standard pipeline (no slash) ──
  const result = matchSingle(normalizedLabel, rawLabel, settings);

  if (result) {
    const sourceLabel = result.source === 'keyword' ? 'keyword match' :
                        `fuzzy match`;
    const scoreInfo = result.source === 'fuzzy' ? ` (score: ${result.score.toFixed(3)})` : ' (score: 0)';
    console.debug(
      `[Forma] "${rawLabel}" → ${sourceLabel} → "${result.profileKey}"${scoreInfo}`
    );
  } else {
    console.debug(`[Forma] "${rawLabel}" → no match found`);
  }

  return result;
}
