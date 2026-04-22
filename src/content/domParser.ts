// ──────────────────────────────────────────────
// Forma — DOM Parser
// Extracts form fields from Google Forms DOM
// ──────────────────────────────────────────────

import type { FormField, FieldType } from '../types/index.js';
import { SELECTORS } from '../utils/constants.js';
import { normalizeLabel, queryFirst, queryAll } from '../utils/helpers.js';

/**
 * Detects the input type within a question container.
 * Returns null if no recognizable input is found
 * (e.g., section headers, description blocks).
 */
function detectInputType(container: Element): FieldType | null {
  if (queryFirst(SELECTORS.TEXT_INPUT, container)) return 'text';
  if (queryFirst(SELECTORS.RADIO_OPTION, container)) return 'radio';
  if (queryFirst(SELECTORS.DROPDOWN_CONTAINER, container)) return 'dropdown';
  return null;
}

/**
 * Parses the currently visible Google Form DOM and extracts
 * all question fields with their labels, normalized labels,
 * and input types.
 *
 * Silently skips containers that have no label or no
 * recognizable input element.
 *
 * @returns Array of FormField objects
 */
export function parseFormFields(): FormField[] {
  const containers = queryAll(SELECTORS.QUESTION_CONTAINER);
  const fields: FormField[] = [];

  for (const container of containers) {
    // Extract label text
    const labelEl = queryFirst(SELECTORS.QUESTION_LABEL, container);
    if (!labelEl) continue;

    const rawLabel = (labelEl as HTMLElement).innerText ?? '';
    const normalized = normalizeLabel(rawLabel);
    if (!normalized) continue;

    // Detect input type
    const inputType = detectInputType(container);
    if (inputType === null) continue; // section header, skip

    fields.push({
      container,
      rawLabel,
      normalizedLabel: normalized,
      inputType,
    });
  }

  console.debug(`[Forma] Parsed ${fields.length} form fields`);
  return fields;
}
