// ──────────────────────────────────────────────
// Forma — Constraint Parser
// Detects embedded instructions in form labels
// ──────────────────────────────────────────────

import type { ConstraintFlag } from '../../types/index.js';

/**
 * Constraint detection rules.
 * Each rule maps a set of trigger phrases (checked as substrings
 * of the lowercase label) to a constraint flag.
 */
const CONSTRAINT_RULES: Array<{
  flag: ConstraintFlag;
  phrases: string[];
}> = [
  {
    flag: 'use-personal-email',
    phrases: [
      'not college',
      'not college domain',
      'personal email',
      'personal mail',
      'non-college',
      'gmail',
    ],
  },
  {
    flag: 'use-college-email',
    phrases: [
      'college email',
      'official email',
      'university email',
      'institute email',
      'institutional email',
    ],
  },
  {
    flag: 'use-country-code',
    phrases: [
      'with country code',
      'include country code',
      '+91',
      'country code',
    ],
  },
];

/**
 * Scans the raw (non-normalized) label text for embedded constraint
 * instructions. Returns the first matching constraint flag, or null.
 *
 * @param rawLabel - The original label text before normalization
 */
export function parseConstraints(rawLabel: string): ConstraintFlag | null {
  const lower = rawLabel.toLowerCase();

  for (const rule of CONSTRAINT_RULES) {
    for (const phrase of rule.phrases) {
      if (lower.includes(phrase)) {
        return rule.flag;
      }
    }
  }

  return null;
}
