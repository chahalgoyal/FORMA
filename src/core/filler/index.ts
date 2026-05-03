// ──────────────────────────────────────────────
// Forma — Filler Router (Intent-First)
// Resolves profile values and routes to the
// correct filler based on field type
// ──────────────────────────────────────────────

import type {
  MatchResult,
  FormaProfile,
  FieldType,
  FormaSettings,
} from '../../types/index.js';
import { getNestedValue, queryFirst } from '../../utils/helpers.js';
import { computeFullName } from '../parser/nameParser.js';
import { fillTextInput } from './textFiller.js';
import { fillRadio } from './radioFiller.js';
import { fillDropdown } from './dropdownFiller.js';
import { DEFAULT_SETTINGS, SELECTORS } from '../../utils/constants.js';

/**
 * Resolves the actual string value to fill based on the
 * match result and the user's profile.
 *
 * Handles computed fields (name.full), constraints (strip
 * country code), and special logic (backlog count when
 * activeBacklog is "No").
 */
export function resolveProfileValue(
  matchResult: MatchResult,
  profile: FormaProfile,
  container?: Element
): string {
  const { profileKey, constraint } = matchResult;

  switch (profileKey) {
    // ── Computed: Full Name ──
    case 'name.full':
      return computeFullName(profile.name);

    // ── Direct Name Parts ──
    case 'name.first':
      return profile.name.first;
    case 'name.middle':
      return profile.name.middle;
    case 'name.last':
      return profile.name.last;

    // ── Phone: sanitize digits, respect input maxlength if present ──
    case 'contact.phone.primary': {
      const rawPrimary = String(profile.contact.phone.primary || '');
      if (constraint === 'use-country-code') {
        return profile.contact.phone.countryCode + rawPrimary;
      }
      const digitsOnlyPrimary = rawPrimary.replace(/\D/g, '');
      return smartTruncatePhone(digitsOnlyPrimary, container);
    }

    case 'contact.phone.alternate': {
      const rawAlt = String(profile.contact.phone.alternate || '');
      if (!rawAlt) return '';
      if (constraint === 'use-country-code') {
        return profile.contact.phone.countryCode + rawAlt;
      }
      const digitsOnlyAlt = rawAlt.replace(/\D/g, '');
      return smartTruncatePhone(digitsOnlyAlt, container);
    }

    // ── Email with constraint override ──
    case 'contact.email.personal':
      return profile.contact.email.personal;
    case 'contact.email.college':
      return profile.contact.email.college;
    case 'contact.email.alternate':
      return profile.contact.email.alternate;

    // ── Backlog count: returns "0" when no active backlog ──
    case 'placement.backlogCount':
      if (profile.placement.activeBacklog === 'No') return '0';
      return profile.placement.backlogCount;

    // ── DOB: handle native date input vs text input ──
    case 'personal.dob': {
      if (container) {
        const input = queryFirst(SELECTORS.TEXT_INPUT, container) as HTMLInputElement | null;
        if (input && input.type === 'date') {
          return profile.personal.dob; // Native inputs require YYYY-MM-DD
        }
      }
      return formatDob(profile.personal.dob); // Fallback text formatting DD/MM/YYYY
    }

    // ── All other fields: resolve via dot-notation path ──
    default:
      return getNestedValue(profile as unknown as Record<string, unknown>, profileKey) ?? '';
  }
}

/**
 * Smartly truncates a phone number based on the input's maxlength.
 * If maxlength is set (e.g., 10 for Indian forms), slice to that length.
 * Otherwise, return the full sanitized digits — avoids corrupting
 * phone numbers from regions with non-10-digit formats (UK, AU, etc.).
 */
function smartTruncatePhone(digits: string, container?: Element): string {
  if (!container) return digits;

  const input = queryFirst(SELECTORS.TEXT_INPUT, container) as HTMLInputElement | null;
  if (!input) return digits;

  const maxLength = input.getAttribute('maxlength');
  if (maxLength) {
    const max = parseInt(maxLength, 10);
    if (!isNaN(max) && max > 0) {
      return digits.slice(-max);
    }
  }

  return digits;
}

/**
 * Reformats DOB from ISO YYYY-MM-DD to DD/MM/YYYY.
 * This is the standard format used in Indian placement forms.
 */
function formatDob(isoDate: string): string {
  if (!isoDate || !isoDate.includes('-')) return isoDate;

  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Main filler function — intent-first approach.
 *
 * First resolves what value to fill (based on the matched
 * profile key), then adapts the filling behavior to the
 * field type (text, radio, dropdown).
 *
 * @param container   - The question container element
 * @param fieldType   - Detected input type
 * @param matchResult - The matching result with profile key
 * @param profile     - The user's profile data
 * @param settings    - Extension settings (for Fuse threshold)
 * @returns true if filled successfully, false if skipped
 */
export async function fill(
  inputElements: Element[],
  fieldType: FieldType,
  matchResult: MatchResult | string,
  profile: FormaProfile,
  settings: FormaSettings = DEFAULT_SETTINGS,
  container?: Element
): Promise<boolean> {
  const value = typeof matchResult === 'string'
    ? matchResult
    : resolveProfileValue(matchResult, profile, container);

  // Empty value = nothing to fill
  if (!value) {
    const keyLabel = typeof matchResult === 'string'
      ? `AI value "${matchResult}"`
      : `Profile key "${matchResult.profileKey}"`;
    console.debug(
      `[Forma] ${keyLabel} resolved to empty value. Skipping.`
    );
    return false;
  }

  switch (fieldType) {
    case 'text':
      return fillTextInput(inputElements, value);

    case 'radio':
      return fillRadio(inputElements, value, settings.fuseThreshold);

    case 'dropdown':
      return fillDropdown(inputElements, value, settings.fuseThreshold);

    default:
      console.warn(`[Forma] Unknown field type: ${fieldType}`);
      return false;
  }
}
