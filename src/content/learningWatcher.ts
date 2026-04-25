// ──────────────────────────────────────────────
// Forma — Learning Watcher
// Detects manual field edits and proposes
// learned mappings via reverse value lookup
// ──────────────────────────────────────────────

import type {
  FormField,
  FormaProfile,
  FormaLearnCandidatePayload,
  ProfileKeyPath,
} from '../types/index.js';
import { SELECTORS } from '../utils/constants.js';
import { getAllLeafValues, queryFirst } from '../utils/helpers.js';

/**
 * Attaches blur/change event listeners to all input elements
 * in the parsed form fields. When a user manually edits a field,
 * performs a reverse lookup to see if the entered value matches
 * any profile field.
 *
 * If a match is found, sends a FORMA_LEARN_CANDIDATE message
 * to the service worker.
 *
 * Context-aware reverse lookup: When multiple profile fields
 * share the same value (e.g., tenth.board and twelfth.board
 * both = "CBSE"), compares the parent attribute name against
 * the original label to disambiguate.
 */
export function attachLearningListeners(
  fields: FormField[],
  profile: FormaProfile
): void {
  const leafValues = getAllLeafValues(profile);

  for (const field of fields) {
    // Only attach to the primary input for text fields (skip radios/dropdowns for now)
    if (field.inputType !== 'text') continue;
    
    const input = field.inputElements[0] as HTMLInputElement | HTMLTextAreaElement | null;
    if (!input) continue;

    // Track the value at fill time to detect changes
    const filledValue = input.value;

    const handler = () => {
      const newValue = input.value.trim();

      // Only trigger if the value actually changed
      if (!newValue || newValue === filledValue) return;

      // Reverse lookup: find all profile keys that match this value
      const matches = leafValues.filter(
        (leaf) => leaf.value === newValue
      );

      if (matches.length === 0) return;

      let bestMatch: { key: ProfileKeyPath; value: string };

      if (matches.length === 1) {
        // Single match — no ambiguity
        bestMatch = matches[0];
      } else {
        // Multiple matches — use context-aware disambiguation
        // Extract parent attributes and check which one appears in the label
        const labelLower = field.normalizedLabel;

        const contextMatch = matches.find((m) => {
          // Extract the parent segment from the key path
          // e.g., "academic.tenth.board" → "tenth"
          // e.g., "academic.twelfth.board" → "twelfth"
          const parts = m.key.split('.');
          // Check the second-to-last part (parent attribute)
          for (const part of parts) {
            if (labelLower.includes(part.toLowerCase())) {
              return true;
            }
          }
          return false;
        });

        if (!contextMatch) {
          // Cannot disambiguate — suppress learning prompt
          console.debug(
            `[Forma] Multiple profile fields match value "${newValue}" for label "${field.rawLabel}". Cannot disambiguate. Suppressing learn prompt.`
          );
          return;
        }

        bestMatch = contextMatch;
      }

      // Send learn candidate to service worker
      const payload: FormaLearnCandidatePayload = {
        normalizedLabel: field.normalizedLabel,
        rawLabel: field.rawLabel,
        enteredValue: newValue,
      };

      console.debug(
        `[Forma] Learn candidate: "${field.normalizedLabel}" → "${bestMatch.key}" (value: "${newValue}")`
      );

      try {
        chrome.runtime.sendMessage({
          type: 'FORMA_LEARN_CANDIDATE',
          payload: {
            ...payload,
            resolvedKey: bestMatch.key,
          },
        });
      } catch {
        // Extension was reloaded — context invalidated. Silently ignore.
      }
    };

    // Listen for blur and change events
    input.addEventListener('blur', handler);
    input.addEventListener('change', handler);
  }

  console.debug(
    `[Forma] Learning listeners attached to ${fields.length} fields`
  );
}
