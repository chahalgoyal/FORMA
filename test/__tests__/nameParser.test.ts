// ──────────────────────────────────────────────
// Forma — Name Parser Tests
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { computeFullName } from '../../src/core/parser/nameParser.js';

describe('Name Parser', () => {
  it('should join first and last name', () => {
    expect(computeFullName({ first: 'Chahal', middle: '', last: 'Goyal' }))
      .toBe('Chahal Goyal');
  });

  it('should include middle name when present', () => {
    expect(computeFullName({ first: 'John', middle: 'Robert', last: 'Doe' }))
      .toBe('John Robert Doe');
  });

  it('should handle only first name', () => {
    expect(computeFullName({ first: 'Chahal', middle: '', last: '' }))
      .toBe('Chahal');
  });

  it('should handle empty name object', () => {
    expect(computeFullName({ first: '', middle: '', last: '' }))
      .toBe('');
  });

  it('should handle first and middle only', () => {
    expect(computeFullName({ first: 'John', middle: 'Robert', last: '' }))
      .toBe('John Robert');
  });
});
