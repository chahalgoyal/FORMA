// ──────────────────────────────────────────────
// Forma — Shared Utility Functions
// ──────────────────────────────────────────────

import type { FormaProfile, ProfileKeyPath } from '../types/index.js';

/**
 * Normalizes a Google Form label for matching:
 * - Lowercases
 * - Strips required-field asterisks
 * - Collapses whitespace
 * - Trims
 */
export function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a dot-notation path on a nested object.
 * E.g., getNestedValue(profile, "academic.college") → "Chandigarh Group of Colleges"
 * Returns undefined if the path doesn't exist.
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Flattens a FormaProfile into an array of { key, value } pairs
 * for every leaf string value. Used by the learning system's
 * reverse lookup to find which profile key corresponds to a
 * user-entered value.
 */
export function getAllLeafValues(
  profile: FormaProfile
): Array<{ key: ProfileKeyPath; value: string }> {
  const results: Array<{ key: ProfileKeyPath; value: string }> = [];

  function walk(obj: unknown, prefix: string): void {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'string') {
      if (obj.length > 0) {
        results.push({ key: prefix as ProfileKeyPath, value: obj });
      }
      return;
    }

    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        walk(v, prefix ? `${prefix}.${k}` : k);
      }
    }
  }

  walk(profile, '');
  return results;
}

/**
 * Tries multiple CSS selectors in priority order and returns
 * the first element found. Returns null if none match.
 */
export function queryFirst(
  selectors: string | readonly string[],
  parent: Element | Document = document
): Element | null {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorList) {
    const el = parent.querySelector(selector as string);
    if (el) return el;
  }

  return null;
}

/**
 * Tries multiple CSS selectors in priority order and returns
 * all matched elements from the first selector that finds results.
 */
export function queryAll(
  selectors: string | readonly string[],
  parent: Element | Document = document
): Element[] {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorList) {
    const els = parent.querySelectorAll(selector as string);
    if (els.length > 0) return Array.from(els);
  }

  return [];
}

/**
 * Simulates a full native mouse click sequence (mousedown -> mouseup -> click).
 * This is necessary for modern Google Forms React/Wiz components that ignore
 * simple HTMLElement.click() calls.
 */
export function simulateClick(element: HTMLElement): void {
  const options = { bubbles: true, cancelable: true, view: window };
  
  // 1. Focus the element
  element.focus();

  // 2. Dispatch Keyboard events (Spacebar often selects radios/checkboxes in accessible frameworks)
  element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));

  // 3. Dispatch Pointer/Mouse events
  if (typeof PointerEvent !== 'undefined') {
    element.dispatchEvent(new PointerEvent('pointerdown', options));
  }
  element.dispatchEvent(new MouseEvent('mousedown', options));
  
  if (typeof PointerEvent !== 'undefined') {
    element.dispatchEvent(new PointerEvent('pointerup', options));
  }
  element.dispatchEvent(new MouseEvent('mouseup', options));
  
  element.dispatchEvent(new MouseEvent('click', options));
  
  // 4. Fallback native click
  element.click();
}

// ─── Bag of Words Matching Utilities ─────────

const STOP_WORDS = new Set([
  // Pronouns & articles
  'what', 'is', 'your', 'the', 'of', 'in', 'a', 'an',
  'for', 'to', 'and', 'or', 'any',
  // Instruction verbs (common form preambles)
  'please', 'enter', 'provide', 'type', 'mention', 'share', 'paste',
  // Form subject words (the user IS the student/candidate)
  'student', 'candidate', 'applicant', 'participant',
  // Noise qualifiers
  'detail', 'details', 'below', 'here', 'only', 'good',
]);

/**
 * Prepares a string for Bag-of-Words strict matching.
 * 1. Lowercase and remove all punctuation (replaces with space).
 * 2. Split into individual words.
 * 3. Filter out stop words, single-char tokens, and empty tokens.
 * 4. Sort alphabetically to create a predictable "bag".
 */
export function tokenizeAndClean(text: string): string[] {
  // Replace anything that isn't a letter or number with a space
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  
  const tokens = cleaned.split(/\s+/);
  
  const validTokens = tokens.filter(
    (token) => token.length > 1 && !STOP_WORDS.has(token)
  );

  // Sort alphabetically so array equality works
  return validTokens.sort();
}

/**
 * Handles common shorthand mappings for radio/dropdown options.
 * E.g., if profile is "Yes", matches options like "Y", "Yes", "True".
 * If profile is "Male", matches "M", "Male".
 * 
 * Returns the element if a shorthand match is found, null otherwise.
 */
export function findBestShorthandMatch<T extends { element: HTMLElement; text: string }>(
  options: T[],
  value: string
): HTMLElement | null {
  const val = value.toLowerCase().trim();
  if (!val) return null;

  const optionsLower = options.map(opt => ({ ...opt, text: opt.text.toLowerCase().trim() }));

  // 1. Exact match (case-insensitive)
  const exact = optionsLower.find(opt => opt.text === val);
  if (exact) return exact.element;

  // 2. Shorthand mappings
  const shorthands: Record<string, string[]> = {
    'yes': ['y', 'yes', 'true', '1'],
    'no': ['n', 'no', 'false', '0'],
    'male': ['m', 'male'],
    'female': ['f', 'female'],
  };

  const allowedShorthands = shorthands[val];
  if (allowedShorthands) {
    const found = optionsLower.find(opt => allowedShorthands.includes(opt.text));
    if (found) return found.element;
  }

  return null;
}
