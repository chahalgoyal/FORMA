// ──────────────────────────────────────────────
// Forma — Layer 3: Structural Matcher
// Handles semantic/contextual cases that
// keyword and fuzzy matching cannot resolve
// ──────────────────────────────────────────────

import type { MatchResult } from '../../types/index.js';

/**
 * Layer 3: Structural matching.
 *
 * Handles special cases that require understanding
 * semantic relationships or format-aware logic:
 *
 * - Split name fields (first name, last name, middle name)
 * - Phone number format constraints (10-digit, no country code)
 * - DOB format hints
 *
 * NOTE: Split name fields are primarily handled by Layer 1's
 * keyword matcher (which has "first name", "last name" patterns).
 * This layer acts as a fallback for unusual phrasings that don't
 * match the keyword patterns.
 *
 * @param normalizedLabel - Cleaned label text
 * @param rawLabel        - Original label text
 * @returns MatchResult with source "structural", or null
 */
// ── Poison words: if label contains any of these, it's someone else's data ──
const POISON_WORDS = [
  'father', 'mother', 'guardian', 'parent', 'spouse',
  'emergency', 'manager', 'referral', 'hr', 'supervisor',
  'company', 'organization', 'employer', 'team', 'event',
  'project', 'mentor', 'friend', 'sibling',
];

export function structuralMatch(
  normalizedLabel: string,
  _rawLabel: string
): MatchResult | null {
  // ── Poison word guard ──
  // If the label references someone else's data, bail out immediately.
  for (const word of POISON_WORDS) {
    if (normalizedLabel.includes(word)) return null;
  }
  // ── Case 1: Split Name Fields (fallback) ──
  if (
    normalizedLabel.includes('first') &&
    (normalizedLabel.includes('name') || normalizedLabel.length < 15)
  ) {
    return {
      profileKey: 'name.first',
      score: 0.1,
      source: 'structural',
      constraint: 'split-first-name',
    };
  }

  if (
    (normalizedLabel.includes('last') || normalizedLabel.includes('surname') ||
     normalizedLabel.includes('family')) &&
    (normalizedLabel.includes('name') || normalizedLabel.length < 15)
  ) {
    return {
      profileKey: 'name.last',
      score: 0.1,
      source: 'structural',
      constraint: 'split-last-name',
    };
  }

  if (
    normalizedLabel.includes('middle') &&
    (normalizedLabel.includes('name') || normalizedLabel.length < 15)
  ) {
    return {
      profileKey: 'name.middle',
      score: 0.1,
      source: 'structural',
      constraint: 'split-middle-name',
    };
  }

  // ── Case 2: Phone Number Format ──
  if (normalizedLabel.includes('phone') || normalizedLabel.includes('mobile')) {
    // If it explicitly asks for country code or +91
    if (
      normalizedLabel.includes('with country') ||
      normalizedLabel.includes('with +91') ||
      normalizedLabel.includes('international format')
    ) {
      return {
        profileKey: 'contact.phone.primary',
        score: 0.1,
        source: 'structural',
        constraint: 'use-country-code',
      };
    }

    // If it explicitly asks for 10 digits or WITHOUT country code
    if (
      normalizedLabel.includes('10 digit') ||
      normalizedLabel.includes('10-digit') ||
      normalizedLabel.includes('without country') ||
      normalizedLabel.includes('without +91') ||
      normalizedLabel.includes('only 10')
    ) {
      return {
        profileKey: 'contact.phone.primary',
        score: 0.1,
        source: 'structural',
      };
    }
  }

  // ── Case 3: Date of Birth ──
  if (
    normalizedLabel.includes('birth') ||
    normalizedLabel.includes('dob') ||
    normalizedLabel.includes('d.o.b')
  ) {
    return {
      profileKey: 'personal.dob',
      score: 0.1,
      source: 'structural',
    };
  }

  return null;
}
