// ──────────────────────────────────────────────
// Forma — Text Input Filler
// Fills <input> and <textarea> elements
// ──────────────────────────────────────────────

/**
 * Fills a text-type input element.
 *
 * Sets the element value and dispatches 'input' and 'change' events
 * to trigger React/Angular/Vue state updates on generic forms.
 *
 * @param inputElements - The extracted input elements array (expected [0] for text)
 * @param value     - The string value to fill
 * @returns true if fill succeeded, false otherwise
 */
export function fillTextInput(inputElements: Element[], value: string): boolean {
  try {
    const input = inputElements[0] as HTMLInputElement | HTMLTextAreaElement | null;

    if (!input) {
      console.warn('[Forma] Text input element is missing');
      return false;
    }

    // Set the value
    input.value = value;

    // Dispatch events for React/Angular/Vue listeners
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Also try dispatching a focus/blur cycle for form validation triggers
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  } catch (error) {
    console.warn(
      `[Forma] Text fill failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    // Attempt to clear the partially set value
    try {
      const input = inputElements[0] as HTMLInputElement | HTMLTextAreaElement | null;
      if (input) input.value = '';
    } catch {
      // Silently ignore cleanup failure
    }

    return false;
  }
}
