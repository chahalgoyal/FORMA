// ──────────────────────────────────────────────
// Forma — Dropdown Filler
// Opens a listbox, matches options, and selects
// ──────────────────────────────────────────────

import Fuse from 'fuse.js';
import { SELECTORS } from '../../utils/constants.js';
import { queryFirst, simulateClick, findBestShorthandMatch } from '../../utils/helpers.js';

/**
 * Creates a promise that resolves after a given delay.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fills a dropdown (listbox) within a question container.
 *
 * Google Forms renders dropdowns as div[role="listbox"]. The options
 * are not in the DOM until the listbox is clicked open.
 *
 * Steps:
 * 1. Click the listbox to open it
 * 2. Wait 150ms for options to render
 * 3. Match profile value via shorthand or Fuse.js
 * 4. Click the best match, or close the dropdown if no match
 *
 * @param container - The question container element
 * @param value     - The profile value to match
 * @param threshold - Fuse.js score threshold (default 0.35)
 * @returns true if an option was selected, false otherwise
 */
export async function fillDropdown(
  container: Element,
  value: string,
  threshold: number = 0.35
): Promise<boolean> {
  try {
    const listbox = queryFirst(SELECTORS.DROPDOWN_CONTAINER, container) as HTMLElement | null;

    if (!listbox) {
      console.warn('[Forma] Dropdown listbox not found in container');
      return false;
    }

    // Step 1: Open the dropdown
    simulateClick(listbox);

    // Step 2: Wait for options to render
    await wait(150);

    // Step 3: Query options
    let optionElements = container.querySelectorAll(SELECTORS.DROPDOWN_OPTION);

    if (optionElements.length === 0) {
      optionElements = document.querySelectorAll(SELECTORS.DROPDOWN_OPTION);
    }

    if (optionElements.length === 0) {
      console.warn('[Forma] No dropdown options found after opening');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }

    // Extract text from each option
    const optionEntries = Array.from(optionElements).map((opt) => {
      let text = opt.getAttribute('data-value') || opt.getAttribute('aria-label') || opt.textContent || '';
      return {
        element: opt as HTMLElement,
        text: text.trim(),
      };
    });

    // Step 4: Matching
    // Try Shorthand / Exact match first
    const shorthandMatch = findBestShorthandMatch(optionEntries, value);
    if (shorthandMatch) {
      simulateClick(shorthandMatch);
      console.debug(`[Forma] Selected dropdown option via shorthand match: "${value}"`);
      return true;
    }

    // Fuse.js fallback
    const fuse = new Fuse(optionEntries, {
      keys: ['text'],
      threshold,
      ignoreLocation: true,
      includeScore: true,
    });

    const results = fuse.search(value);

    if (results.length === 0 || results[0].score === undefined || results[0].score >= threshold) {
      console.debug(`[Forma] No dropdown option matched for value "${value}"`);
      // Close the dropdown
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }

    // Click the best matching option
    const bestMatch = results[0].item;
    simulateClick(bestMatch.element);

    console.debug(
      `[Forma] Selected dropdown option "${bestMatch.text}" (score: ${results[0].score.toFixed(3)})`
    );
    return true;
  } catch (error) {
    console.warn(
      `[Forma] Dropdown fill failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    // Attempt to close the dropdown
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    } catch {
      // Silently ignore
    }

    return false;
  }
}
