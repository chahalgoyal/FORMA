// ──────────────────────────────────────────────
// Forma — Name Parser
// Computes full name and splits name parts
// ──────────────────────────────────────────────

import type { FormaProfile } from '../../types/index.js';

/**
 * Computes the full name by joining first, middle, last
 * and filtering out empty parts.
 */
export function computeFullName(name: FormaProfile['name']): string {
  return [name.first, name.middle, name.last]
    .filter(Boolean)
    .join(' ');
}
