// ──────────────────────────────────────────────
// Forma — Highlighter
// Injects CSS and applies highlight classes
// to question containers
// ──────────────────────────────────────────────

import { HIGHLIGHT_CLASSES } from '../utils/constants.js';

const STYLE_TAG_ID = 'forma-highlight-styles';

/**
 * Injects the highlight CSS classes into the page <head>.
 * Only injects once — subsequent calls are no-ops if the
 * style tag already exists.
 */
export function injectHighlightStyles(): void {
  if (document.getElementById(STYLE_TAG_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASSES.FILLED} {
      background-color: #eef7ee !important;
      border-left: 5px solid #bcc4b4 !important;
      transition: background-color 0.3s ease;
    }

    .${HIGHLIGHT_CLASSES.SKIPPED} {
      background-color: #fff4e6 !important;
      border-left: 5px solid #d6984e !important;
      transition: background-color 0.3s ease;
    }
  `;

  document.head.appendChild(style);
}

/**
 * Applies a highlight class to a question container.
 *
 * @param container - The question container element
 * @param type      - "filled" (green) or "skipped" (yellow)
 */
export function applyHighlight(
  container: Element,
  type: 'filled' | 'skipped'
): void {
  // Remove any existing highlight first
  container.classList.remove(HIGHLIGHT_CLASSES.FILLED, HIGHLIGHT_CLASSES.SKIPPED);

  // Apply the new highlight
  const className =
    type === 'filled' ? HIGHLIGHT_CLASSES.FILLED : HIGHLIGHT_CLASSES.SKIPPED;
  container.classList.add(className);
}

/**
 * Removes all Forma highlight classes from all elements on the page.
 */
export function clearAllHighlights(): void {
  const filled = document.querySelectorAll(`.${HIGHLIGHT_CLASSES.FILLED}`);
  const skipped = document.querySelectorAll(`.${HIGHLIGHT_CLASSES.SKIPPED}`);

  filled.forEach((el) => el.classList.remove(HIGHLIGHT_CLASSES.FILLED));
  skipped.forEach((el) => el.classList.remove(HIGHLIGHT_CLASSES.SKIPPED));

  console.debug('[Forma] All highlights cleared');
}
