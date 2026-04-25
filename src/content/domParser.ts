// ──────────────────────────────────────────────
// Forma — Universal Semantic DOM Parser
// Extracts form fields from any generic web form
// ──────────────────────────────────────────────

import type { FormField, FieldType } from '../types/index.js';
import { normalizeLabel } from '../utils/helpers.js';

// Elements that we consider as targetable inputs
const TARGET_INPUTS = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"])',
  'textarea',
  'select',
  '[role="listbox"]', // Google Forms dropdown
].join(', ');

const TARGET_RADIOS = [
  'input[type="radio"]',
  '[role="radiogroup"]', // Google Forms radio group
].join(', ');

// Labels that screen readers use but don't contain the actual question text
const IGNORED_GENERIC_LABELS = [
  'single line text',
  'enter your answer',
  'other answer',
  'choose an option',
  'select an option',
  'choose',
  'select'
];

/**
 * Attempts to extract the semantic label for an element using
 * standard W3C accessibility rules, with fallbacks for MS Forms.
 */
function resolveLabel(el: Element): string | null {
  let labelText = '';

  // 1. Check aria-labelledby
  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    // aria-labelledby can have multiple IDs separated by space
    const ids = ariaLabelledBy.split(/\s+/);
    const labels = ids.map(id => document.getElementById(id)?.innerText || '').filter(Boolean);
    labelText = labels.join(' ');
  }

  // 2. Check aria-label
  if (!labelText) {
    labelText = el.getAttribute('aria-label') || '';
  }

  // 3. Check explicit <label for="id">
  if (!labelText && el.id) {
    const labelEl = document.querySelector(`label[for="${el.id}"]`);
    if (labelEl) labelText = (labelEl as HTMLElement).innerText;
  }

  // 4. Check implicit wrapping <label>
  if (!labelText) {
    const parentLabel = el.closest('label');
    if (parentLabel) {
      // Get all text but exclude the input's own text if any
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      const inputsInLabel = clone.querySelectorAll('input, textarea, select');
      inputsInLabel.forEach(input => input.remove());
      labelText = clone.innerText;
    }
  }

  // Clean up and check if it's a generic garbage label
  labelText = labelText.trim();
  const normalizedLower = labelText.toLowerCase();
  
  if (labelText && !IGNORED_GENERIC_LABELS.some(g => normalizedLower.includes(g))) {
    return labelText;
  }

  // 5. Fallback for stubborn sites (like Microsoft Forms)
  // Walk up the DOM looking for a heading role, an <h1>-<h6>, or a strong text node
  let current: Element | null = el.parentElement;
  let attempts = 0;
  
  while (current && attempts < 5) {
    // Check for explicit heading inside this container
    const heading = current.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
    if (heading && (heading as HTMLElement).innerText) {
      return (heading as HTMLElement).innerText.trim();
    }
    
    // If it's a Google Form container, it has a specific heading
    const gFormHeading = current.querySelector('div[role="heading"]');
    if (gFormHeading && (gFormHeading as HTMLElement).innerText) {
       return (gFormHeading as HTMLElement).innerText.trim();
    }

    current = current.parentElement;
    attempts++;
  }

  // 6. Last resort: Placeholder
  return el.getAttribute('placeholder') || null;
}

/**
 * Parses the currently visible DOM and extracts all semantic form fields.
 */
export function parseFormFields(): FormField[] {
  const fields: FormField[] = [];
  
  // 1. Find all standalone inputs (text, select, dropdown)
  const standaloneInputs = document.querySelectorAll(TARGET_INPUTS);
  for (const input of Array.from(standaloneInputs)) {
    const rawLabel = resolveLabel(input);
    if (!rawLabel) continue;

    const normalized = normalizeLabel(rawLabel);
    if (!normalized) continue;

    let inputType: FieldType = 'text';
    if (input.tagName === 'SELECT' || input.getAttribute('role') === 'listbox') {
      inputType = 'dropdown';
    }

    fields.push({
      container: input.closest('div[data-params]') || input.parentElement || input, // Fallback for container
      inputElements: [input],
      rawLabel,
      normalizedLabel: normalized,
      inputType
    });
  }

  // 2. Find Radio Groups
  // Standard radios are grouped by name, Google Forms grouped by role
  const radioInputs = document.querySelectorAll(TARGET_RADIOS);
  const processedRadioNames = new Set<string>();

  for (const radio of Array.from(radioInputs)) {
    if (radio.getAttribute('role') === 'radiogroup') {
      // Google forms native grouping
      const rawLabel = resolveLabel(radio);
      if (!rawLabel) continue;

      const normalized = normalizeLabel(rawLabel);
      if (normalized) {
        fields.push({
          container: radio.closest('div[data-params]') || radio,
          inputElements: [radio],
          rawLabel,
          normalizedLabel: normalized,
          inputType: 'radio'
        });
      }
    } else if (radio.tagName === 'INPUT' && (radio as HTMLInputElement).type === 'radio') {
      // Standard HTML Radio Button
      const name = (radio as HTMLInputElement).name;
      if (name && processedRadioNames.has(name)) continue; // Already processed this group
      if (name) processedRadioNames.add(name);

      // Find all radios in this group
      const groupElements = name 
        ? Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`))
        : [radio];

      // To find the label for the group, we walk up to a common ancestor (like a fieldset)
      let groupLabel = null;
      
      const fieldset = radio.closest('fieldset');
      if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) groupLabel = legend.innerText;
      }

      // If no fieldset, try walking up and finding a heading (like MS Forms)
      if (!groupLabel) {
        let current: Element | null = radio.parentElement;
        let attempts = 0;
        while (current && attempts < 5 && !groupLabel) {
          const heading = current.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
          if (heading) groupLabel = (heading as HTMLElement).innerText;
          current = current.parentElement;
          attempts++;
        }
      }

      if (!groupLabel) continue;

      const normalized = normalizeLabel(groupLabel);
      if (normalized) {
        fields.push({
          container: fieldset || radio.parentElement || radio,
          inputElements: groupElements,
          rawLabel: groupLabel,
          normalizedLabel: normalized,
          inputType: 'radio'
        });
      }
    }
  }

  console.debug(`[Forma] Parsed ${fields.length} semantic form fields`);
  return fields;
}
