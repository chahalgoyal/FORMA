// ──────────────────────────────────────────────
// Forma — Text Input Filler
// Fills <input> and <textarea> elements
// ──────────────────────────────────────────────

import { SELECTORS } from '../../utils/constants.js';
import { queryFirst } from '../../utils/helpers.js';

/**
 * Fills a text-type input element within a question container.
 *
 * Sets the element value and dispatches 'input' and 'change' events
 * to trigger Google Forms' React state updates. Without these events,
 * the form won't register the filled value on submission.
 *
 * @param container - The question container element
 * @param value     - The string value to fill
 * @returns true if fill succeeded, false otherwise
 */
export function fillTextInput(container: Element, value: string): boolean {
  try {
    const input = queryFirst(SELECTORS.TEXT_INPUT, container) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;

    if (!input) {
      console.warn('[Forma] Text input element not found in container');
      return false;
    }

    // Set the value
    input.value = value;

    // Dispatch events for Google Forms' React listeners
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Also try dispatching a focus/blur cycle for form validation
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  } catch (error) {
    console.warn(
      `[Forma] Text fill failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    // Attempt to clear the partially set value
    try {
      const input = queryFirst(SELECTORS.TEXT_INPUT, container) as
        | HTMLInputElement
        | null;
      if (input) input.value = '';
    } catch {
      // Silently ignore cleanup failure
    }

    return false;
  }
}
