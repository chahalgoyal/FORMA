// ──────────────────────────────────────────────
// Forma — Dropdown Filler
// Fills <select> or Google Forms [role="listbox"]
// ──────────────────────────────────────────────

import Fuse from 'fuse.js';
import { SELECTORS } from '../../utils/constants.js';
import { queryFirst, simulateClick, findBestShorthandMatch } from '../../utils/helpers.js';

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
        selectEl.value = (shorthandMatch as HTMLOptionElement).value;
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
        selectEl.value = (results[0].item.element as HTMLOptionElement).value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }

    // ── Handle Google Forms custom listbox ──
    simulateClick(listbox);
    await wait(150); // wait for dropdown to render in DOM

    // Options in Google Forms are usually rendered in a portal or at the end of the container
    let optionElements = document.querySelectorAll(SELECTORS.DROPDOWN_OPTION);
    if (optionElements.length === 0) {
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
