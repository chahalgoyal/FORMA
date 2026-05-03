// ──────────────────────────────────────────────
// Forma — Text Input Filler
// Fills <input> and <textarea> elements
// Uses native prototype setters for React/SPA compatibility
// ──────────────────────────────────────────────

// Cache the native value setters from the prototype chain.
// React 16+ overrides the `value` setter on DOM element instances
// to track internal state via a synthetic event system. Setting
// `input.value = x` directly bypasses this, causing the field to
// visually update but React's state to remain empty ("ghost fill").
// By calling the *native* setter, we write the value at the DOM level,
// and the subsequent InputEvent forces React to reconcile.
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype, 'value'
)?.set;

const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype, 'value'
)?.set;

/**
 * Fills a text-type input element using native prototype setters
 * to ensure compatibility with React, Angular, and Vue SPAs.
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

    // ── Handle contenteditable elements ──
    if (input.getAttribute('contenteditable') === 'true') {
      input.textContent = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // ── Set value via native prototype setter (React-safe) ──
    const setter = input.tagName === 'TEXTAREA'
      ? nativeTextAreaValueSetter
      : nativeInputValueSetter;

    if (setter) {
      setter.call(input, value);
    } else {
      // Absolute fallback — only if prototype descriptors are unavailable
      input.value = value;
    }

    // Dispatch InputEvent (not plain Event) — React listens for this specifically
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Focus/blur cycle for form validation triggers
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
