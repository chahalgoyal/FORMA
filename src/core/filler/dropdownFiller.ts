// ──────────────────────────────────────────────
// Forma — Dropdown Filler
// Fills <select> or Google Forms [role="listbox"]
// Uses native prototype setters for React/SPA compatibility
// ──────────────────────────────────────────────

import Fuse from 'fuse.js';
import { SELECTORS } from '../../utils/constants.js';
import { queryFirst, simulateClick, findBestShorthandMatch } from '../../utils/helpers.js';

// Cache the native value setter for <select> — React overrides it.
const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLSelectElement.prototype, 'value'
)?.set;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fillDropdown(
  inputElements: Element[],
  value: string,
  threshold: number = 0.35
): Promise<boolean> {
  try {
    const listbox = inputElements[0] as HTMLElement | null;
    if (!listbox) return false;

    // ── Handle Native <select> ──
    if (listbox.tagName === 'SELECT') {
      const selectEl = listbox as HTMLSelectElement;
      const optionEntries = Array.from(selectEl.options).map(opt => ({
        element: opt,
        text: opt.text.trim()
      }));

      // Shorthand Match
      const shorthandMatch = findBestShorthandMatch(optionEntries, value);
      if (shorthandMatch) {
      // React-safe: use native setter
      if (nativeSelectValueSetter) {
        nativeSelectValueSetter.call(selectEl, (shorthandMatch as HTMLOptionElement).value);
      } else {
        selectEl.value = (shorthandMatch as HTMLOptionElement).value;
      }
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      // Fuse Match
      const fuse = new Fuse(optionEntries, {
        keys: ['text'],
        threshold,
        ignoreLocation: true,
        includeScore: true,
      });

      const results = fuse.search(value);
      if (results.length > 0 && results[0].score !== undefined && results[0].score < threshold) {
        // React-safe: use native setter
        if (nativeSelectValueSetter) {
          nativeSelectValueSetter.call(selectEl, (results[0].item.element as HTMLOptionElement).value);
        } else {
          selectEl.value = (results[0].item.element as HTMLOptionElement).value;
        }
        selectEl.dispatchEvent(new Event('input', { bubbles: true }));
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }

    // ── Handle Google Forms custom listbox ──
    simulateClick(listbox);

    // Poll for options to appear in the DOM (replaces hardcoded 150ms race condition).
    // Options in Google Forms are rendered asynchronously in a portal.
    // We check every 50ms, up to a maximum of 1000ms.
    let optionElements: NodeListOf<Element> | null = null;

    // Try to scope the query to this specific listbox via aria-controls
    const controlsId = listbox.getAttribute('aria-controls');

    for (let elapsed = 0; elapsed < 1000; elapsed += 50) {
      await wait(50);

      if (controlsId) {
        // Scoped query: only grab options belonging to THIS listbox
        const controlledEl = document.getElementById(controlsId);
        if (controlledEl) {
          const scoped = controlledEl.querySelectorAll(SELECTORS.DROPDOWN_OPTION);
          if (scoped.length > 0) {
            optionElements = scoped;
            break;
          }
        }
      }

      // Fallback: global query (for forms that don't use aria-controls)
      const global = document.querySelectorAll(SELECTORS.DROPDOWN_OPTION);
      if (global.length > 0) {
        optionElements = global;
        break;
      }
    }

    if (!optionElements || optionElements.length === 0) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }

    const optionEntries = Array.from(optionElements).map((opt) => ({
      element: opt as HTMLElement,
      text: (opt.getAttribute('data-value') || opt.getAttribute('aria-label') || opt.textContent || '').trim(),
    }));

    // Shorthand
    const shorthandMatch = findBestShorthandMatch(optionEntries, value);
    if (shorthandMatch) {
      simulateClick(shorthandMatch);
      return true;
    }

    // Fuse
    const fuse = new Fuse(optionEntries, {
      keys: ['text'],
      threshold,
      ignoreLocation: true,
      includeScore: true,
    });

    const results = fuse.search(value);
    if (results.length > 0 && results[0].score !== undefined && results[0].score < threshold) {
      simulateClick(results[0].item.element);
      return true;
    }

    // Fallback: close dropdown
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  } catch (error) {
    console.warn(`[Forma] Dropdown fill failed: ${error}`);
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    } catch {}
    return false;
  }
}
