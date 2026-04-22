// ──────────────────────────────────────────────
// Forma — Radio Button Filler
// Finds and clicks the best matching radio option
// ──────────────────────────────────────────────

import Fuse from 'fuse.js';
import { SELECTORS } from '../../utils/constants.js';
import { simulateClick, findBestShorthandMatch } from '../../utils/helpers.js';

/**
 * Fills a radio button group within a question container.
 *
 * Extracts the visible text from each radio option, then uses
 * a two-step matching approach:
 * 1. Exact/Shorthand matching (e.g., "Yes" matches "Y")
 * 2. Fuse.js fuzzy matching as a fallback
 *
 * @param container - The question container element
 * @param value     - The profile value to match (e.g., "Male", "Yes")
 * @param threshold - Fuse.js score threshold (default 0.35)
 * @returns true if a radio option was clicked, false otherwise
 */
export function fillRadio(
  container: Element,
  value: string,
  threshold: number = 0.35
): boolean {
  try {
    const options = container.querySelectorAll(SELECTORS.RADIO_OPTION);

    if (options.length === 0) {
      console.warn('[Forma] No radio options found in container');
      return false;
    }

    // Extract text from each option
    const optionEntries = Array.from(options).map((opt) => {
      let text = opt.getAttribute('data-value') || opt.getAttribute('aria-label') || opt.textContent || '';
      return {
        element: opt as HTMLElement,
        text: text.trim(),
      };
    });

    // Step 1: Shorthand / Exact match
    const shorthandMatch = findBestShorthandMatch(optionEntries, value);
    if (shorthandMatch) {
      simulateClick(shorthandMatch);
      console.debug(`[Forma] Clicked radio option via shorthand match: "${value}"`);
      return true;
    }

    // Step 2: Use Fuse.js to find the best text match as fallback
    const fuse = new Fuse(optionEntries, {
      keys: ['text'],
      threshold,
      ignoreLocation: true,
      includeScore: true,
    });

    const results = fuse.search(value);

    if (results.length === 0 || results[0].score === undefined || results[0].score >= threshold) {
      console.debug(`[Forma] No radio option matched for value "${value}"`);
      return false;
    }

    // Click the best matching option
    const bestMatch = results[0].item;
    simulateClick(bestMatch.element);

    console.debug(
      `[Forma] Clicked radio option "${bestMatch.text}" (score: ${results[0].score.toFixed(3)})`
    );
    return true;
  } catch (error) {
    console.warn(
      `[Forma] Radio fill failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }
}
