// ──────────────────────────────────────────────
// Forma — Radio Input Filler
// Fills <input type="radio"> or [role="radiogroup"]
// ──────────────────────────────────────────────

import Fuse from 'fuse.js';
import { SELECTORS } from '../../utils/constants.js';
import { queryFirst, simulateClick, findBestShorthandMatch } from '../../utils/helpers.js';

export function fillRadio(
  inputElements: Element[],
  value: string,
  threshold: number = 0.35
): boolean {
  try {
    if (!inputElements || inputElements.length === 0) return false;

    // ── Handle Google Forms custom radiogroup ──
    if (inputElements[0].getAttribute('role') === 'radiogroup') {
      const container = inputElements[0];
      const optionElements = Array.from(container.querySelectorAll(SELECTORS.RADIO_OPTION));
      if (optionElements.length === 0) return false;

      const optionEntries = optionElements.map((opt) => ({
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
      return false;
    }

    // ── Handle Native <input type="radio"> group ──
    const optionEntries = inputElements.map((radio) => {
      let labelText = radio.getAttribute('value') || '';
      
      // Look for an associated label to get the human-readable text
      if (radio.id) {
        const labelEl = document.querySelector(`label[for="${radio.id}"]`);
        if (labelEl) labelText = (labelEl as HTMLElement).innerText;
      }
      if (!labelText) {
        const parentLabel = radio.closest('label');
        if (parentLabel) labelText = parentLabel.innerText;
      }

      return {
        element: radio as HTMLElement,
        text: labelText.trim()
      };
    }).filter(entry => entry.text);

    // Shorthand
    const shorthandMatch = findBestShorthandMatch(optionEntries, value);
    if (shorthandMatch) {
      const radio = shorthandMatch as HTMLInputElement;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
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
      const radio = results[0].item.element as HTMLInputElement;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  } catch (error) {
    console.warn(`[Forma] Radio fill failed: ${error}`);
    return false;
  }
}
