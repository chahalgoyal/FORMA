// ──────────────────────────────────────────────
// Forma — Constraint Parser Tests
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { parseConstraints } from '../../src/core/parser/constraintParser.js';

describe('Constraint Parser', () => {
  // ── Personal Email Constraints ──
  it('should detect "not college domain" as use-personal-email', () => {
    expect(parseConstraints('Email ID (not college domain)')).toBe('use-personal-email');
  });

  it('should detect "personal email" as use-personal-email', () => {
    expect(parseConstraints('Personal Email Address')).toBe('use-personal-email');
  });

  it('should detect "non-college" as use-personal-email', () => {
    expect(parseConstraints('Enter your non-college email')).toBe('use-personal-email');
  });

  it('should detect "gmail" as use-personal-email', () => {
    expect(parseConstraints('Gmail ID')).toBe('use-personal-email');
  });

  // ── College Email Constraints ──
  it('should detect "college email" as use-college-email', () => {
    expect(parseConstraints('College Email ID')).toBe('use-college-email');
  });

  it('should detect "official email" as use-college-email', () => {
    expect(parseConstraints('Official Email Address')).toBe('use-college-email');
  });

  it('should detect "university email" as use-college-email', () => {
    expect(parseConstraints('University Email')).toBe('use-college-email');
  });

  // ── Phone Constraints ──
  it('should return null for "10 digit" (since default is 10 digit)', () => {
    expect(parseConstraints('Mobile Number (10 digit)')).toBeNull();
  });

  it('should detect "with country code" as use-country-code', () => {
    expect(parseConstraints('Phone with country code')).toBe('use-country-code');
  });

  it('should detect "+91" as use-country-code', () => {
    expect(parseConstraints('Phone (+91)')).toBe('use-country-code');
  });

  // ── No Constraint ──
  it('should return null for labels without constraints', () => {
    expect(parseConstraints('Student Full Name')).toBeNull();
  });

  it('should return null for generic email label', () => {
    expect(parseConstraints('Email Address')).toBeNull();
  });

  it('should return null for generic phone label', () => {
    expect(parseConstraints('Mobile Number')).toBeNull();
  });
});
