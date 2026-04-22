// ──────────────────────────────────────────────
// Forma — Matcher Unit Tests
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { keywordMatch } from '../../src/core/matcher/keywordMatcher.js';
import { fuzzyMatch } from '../../src/core/matcher/fuzzyMatcher.js';
import { structuralMatch } from '../../src/core/matcher/structuralMatcher.js';
import { match } from '../../src/core/matcher/index.js';
import type { LearnedMapping, FormaSettings } from '../../src/types/index.js';
import { DEFAULT_SETTINGS } from '../../src/utils/constants.js';

// ──────────────────────────────────────────────
// Layer 1: Keyword Matcher
// ──────────────────────────────────────────────

describe('Layer 1: Keyword Matcher', () => {
  it('should match "student full name" to name.full', () => {
    const result = keywordMatch('student full name', 'Student Full Name');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('name.full');
    expect(result!.source).toBe('keyword');
  });

  it('should match "name" to name.full (generic)', () => {
    const result = keywordMatch('name', 'Name');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('name.full');
  });

  it('should match "first name" to name.first (before name.full)', () => {
    const result = keywordMatch('first name', 'First Name');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('name.first');
  });

  it('should match "last name" to name.last', () => {
    const result = keywordMatch('last name', 'Last Name');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('name.last');
  });

  it('should match "college name" to academic.college (not name.full)', () => {
    const result = keywordMatch('college name', 'College Name');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.college');
  });

  it('should match "university name" to academic.college (not name.full)', () => {
    const result = keywordMatch('university name', 'University Name');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.college');
  });

  it('should match "10th percentage" to academic.tenth.percentage', () => {
    const result = keywordMatch('10th percentage', '10th Percentage');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.tenth.percentage');
  });

  it('should match "12th board" to academic.twelfth.board', () => {
    const result = keywordMatch('12th board', '12th Board');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.twelfth.board');
  });

  it('should match "enrollment number" to academic.enrollment', () => {
    const result = keywordMatch('enrollment number', 'Enrollment Number');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.enrollment');
  });

  it('should match "email" to contact.email.personal by default', () => {
    const result = keywordMatch('email', 'Email');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.email.personal');
  });

  it('should match "college email" to contact.email.college', () => {
    const result = keywordMatch('college email', 'College Email');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.email.college');
  });

  it('should match "phone" to contact.phone.primary', () => {
    const result = keywordMatch('phone', 'Phone');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.phone.primary');
  });

  it('should match "active backlog" to placement.activeBacklog', () => {
    const result = keywordMatch('active backlog', 'Active Backlog');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('placement.activeBacklog');
  });

  it('should match "number of backlogs" to placement.backlogCount (before activeBacklog)', () => {
    const result = keywordMatch('number of backlogs', 'Number of Backlogs');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('placement.backlogCount');
  });

  it('should match "gender" to personal.gender', () => {
    const result = keywordMatch('gender', 'Gender');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('personal.gender');
  });

  it('should return null for unrelated labels', () => {
    const result = keywordMatch('why do you want this job', 'Why do you want this job?');
    expect(result).toBeNull();
  });

  // ── Enrollment vs College specificity ──

  it('should match "university id" to academic.enrollment (not college)', () => {
    const result = keywordMatch('university id', 'University ID');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.enrollment');
  });

  it('should NOT match "aicte student id" (ambiguous — should be skipped)', () => {
    const result = keywordMatch('aicte student id', 'AICTE Student ID');
    // "student id" was removed from enrollment patterns,
    // and "aicte" doesn't match anything — should return null
    expect(result).toBeNull();
  });

  it('should still match "university" alone to academic.college', () => {
    const result = keywordMatch('university', 'University');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.college');
  });

  it('should skip heavily modified labels in strict BoW matching', () => {
    // With BoW, "email id (personal, not college domain)" is strictly NOT "email id"
    const result = keywordMatch(
      'email id (personal, not college domain)',
      'Email ID (Personal, not college domain)'
    );
    expect(result).toBeNull(); // Correctly skips to avoid false positives
  });

  it('should detect use-country-code constraint on exact BoW match', () => {
    // If we exactly match "phone number" but the raw label contained "+91"
    const result = keywordMatch(
      'phone number', // tokens: "number", "phone"
      'Phone Number (+91)'
    );
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.phone.primary');
    expect(result!.constraint).toBe('use-country-code');
  });
});

// ──────────────────────────────────────────────
// Layer 2: Fuzzy Matcher
// ──────────────────────────────────────────────

describe('Layer 2: Fuzzy Matcher', () => {
  it('should fuzzy-match "contact no" to phone at relaxed threshold', () => {
    // "contact no" is close to pattern "contact number" — use a slightly relaxed threshold
    const result = fuzzyMatch('contact no', 'Contact No', 0.45);
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.phone.primary');
    expect(result!.source).toBe('fuzzy');
  });

  it('should reject "why do you want to join"', () => {
    const result = fuzzyMatch('why do you want to join', 'Why do you want to join?', 0.35);
    expect(result).toBeNull();
  });

  it('should fuzzy-match with typo "prmary mobile"', () => {
    const result = fuzzyMatch('prmary mobile', 'Prmary Mobile', 0.35);
    expect(result).not.toBeNull();
    // Should match primary mobile/phone
    expect(result!.profileKey).toBe('contact.phone.primary');
  });
});

// ──────────────────────────────────────────────
// Layer 3: Structural Matcher
// ──────────────────────────────────────────────

describe('Layer 3: Structural Matcher', () => {
  it('should match "given first name" structurally', () => {
    const result = structuralMatch('given first name', 'Given First Name');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('name.first');
    expect(result!.constraint).toBe('split-first-name');
  });

  it('should match labels containing "birth" to personal.dob', () => {
    const result = structuralMatch('date of birth dd/mm/yyyy', 'Date of Birth DD/MM/YYYY');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('personal.dob');
  });
});

// ──────────────────────────────────────────────
// Full Matcher Orchestrator
// ──────────────────────────────────────────────

describe('Matcher Orchestrator', () => {
  const settings = DEFAULT_SETTINGS;

  it('should prioritize learned mappings over static', () => {
    const learnedMappings: LearnedMapping[] = [
      {
        normalizedLabel: 'student name',
        profileKey: 'name.first', // intentionally different from static
        savedAt: Date.now(),
      },
    ];

    const result = match('student name', 'Student Name', learnedMappings, settings);
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('name.first');
    expect(result!.source).toBe('learned');
  });

  it('should fall through to keyword when no learned mapping', () => {
    const result = match('student name', 'Student Name', [], settings);
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('name.full');
    expect(result!.source).toBe('keyword');
  });

  it('should return null for completely unrelated labels', () => {
    const result = match(
      'describe your strengths and weaknesses in detail',
      'Describe your strengths and weaknesses in detail',
      [],
      settings
    );
    expect(result).toBeNull();
  });
});
