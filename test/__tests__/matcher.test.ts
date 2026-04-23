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

  // ── Resume Link ──

  it('should match "resume link" to contact.resumeLink', () => {
    const result = keywordMatch('resume link', 'Resume Link');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.resumeLink');
  });

  it('should match "cv link" to contact.resumeLink', () => {
    const result = keywordMatch('cv link', 'CV Link');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.resumeLink');
  });

  it('should match "resume url" to contact.resumeLink', () => {
    const result = keywordMatch('resume url', 'Resume URL');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.resumeLink');
  });

  it('should match "cv url" to contact.resumeLink', () => {
    const result = keywordMatch('cv url', 'CV URL');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.resumeLink');
  });

  it('should match "link of resume" (stop word "of" stripped) to contact.resumeLink', () => {
    // "link of resume" → tokens: ["link", "resume"] → same as "resume link"
    const result = keywordMatch('link of resume', 'Link of Resume');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.resumeLink');
  });

  it('should match "resume drive link" to contact.resumeLink', () => {
    const result = keywordMatch('resume drive link', 'Resume Drive Link');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.resumeLink');
  });

  it('should match "provide your resume link" (stop words stripped) to contact.resumeLink', () => {
    // "provide your resume link" → tokens: ["link", "resume"] (provide, your are stop words)
    const result = keywordMatch('provide your resume link', 'Provide your Resume Link');
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.resumeLink');
  });

  it('should NOT match standalone "resume" (could be file upload)', () => {
    const result = keywordMatch('resume', 'Resume');
    expect(result).toBeNull();
  });

  it('should NOT match "upload your resume" (not a link field)', () => {
    const result = keywordMatch('upload your resume', 'Upload your Resume');
    expect(result).toBeNull();
  });

  it('should NOT match "cv" alone (ambiguous)', () => {
    const result = keywordMatch('cv', 'CV');
    expect(result).toBeNull();
  });

  // ── Poison word rejection ──

  it('should NOT match "father\'s name" (poison word blocks entire label)', () => {
    const result = keywordMatch("father's name", "Father's Name");
    expect(result).toBeNull();
  });

  it('should NOT match "mother\'s phone number" (poison word)', () => {
    const result = keywordMatch("mother's phone number", "Mother's Phone Number");
    expect(result).toBeNull();
  });

  it('should NOT match "company email" (poison word: company)', () => {
    const result = keywordMatch('company email', 'Company Email');
    expect(result).toBeNull();
  });

  it('should NOT match "name of the event" (poison word: event)', () => {
    const result = keywordMatch('name of the event', 'Name of the event');
    expect(result).toBeNull();
  });

  it('should NOT match "project name" (poison word: project)', () => {
    const result = keywordMatch('project name', 'Project Name');
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────
// Layer 2: Fuzzy Matcher
// ──────────────────────────────────────────────

describe('Layer 2: Fuzzy Matcher', () => {
  it('should fuzzy-match \"contact no\" to phone at relaxed threshold', () => {
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

  it('should fuzzy-match with typo "prmary mobile" at relaxed threshold', () => {
    const result = fuzzyMatch('prmary mobile', 'Prmary Mobile', 0.45);
    expect(result).not.toBeNull();
    // Should match primary mobile/phone
    expect(result!.profileKey).toBe('contact.phone.primary');
  });

  // ── Single-token rejection ──

  it('should reject "city" (single token, too ambiguous)', () => {
    const result = fuzzyMatch('city', 'City', 0.35);
    expect(result).toBeNull();
  });

  it('should reject "state" (single token)', () => {
    const result = fuzzyMatch('state', 'State', 0.35);
    expect(result).toBeNull();
  });

  it('should reject "country" (single token)', () => {
    const result = fuzzyMatch('country', 'Country', 0.35);
    expect(result).toBeNull();
  });

  it('should reject "address" (single token)', () => {
    const result = fuzzyMatch('address', 'Address', 0.35);
    expect(result).toBeNull();
  });

  // ── Poison word rejection ──

  it('should reject "father\'s name" (poison word: father)', () => {
    const result = fuzzyMatch("father's name", "Father's Name", 0.35);
    expect(result).toBeNull();
  });

  it('should reject "mother\'s contact number" (poison word: mother)', () => {
    const result = fuzzyMatch("mother's contact number", "Mother's Contact Number", 0.35);
    expect(result).toBeNull();
  });

  it('should reject "parent\'s email address" (poison word: parent)', () => {
    const result = fuzzyMatch("parent's email address", "Parent's Email Address", 0.35);
    expect(result).toBeNull();
  });

  it('should reject "emergency contact number" (poison word: emergency)', () => {
    const result = fuzzyMatch('emergency contact number', 'Emergency Contact Number', 0.35);
    expect(result).toBeNull();
  });

  it('should reject "company name" (poison word: company)', () => {
    const result = fuzzyMatch('company name', 'Company Name', 0.35);
    expect(result).toBeNull();
  });

  // ── Token overlap rejection ──

  it('should reject "PAN Number" (low token overlap with phone patterns)', () => {
    const result = fuzzyMatch('pan number', 'PAN Number', 0.35);
    expect(result).toBeNull();
  });

  it('should reject "name of the event" (low overlap after stop-word stripping)', () => {
    const result = fuzzyMatch('name of the event', 'Name of the event', 0.35);
    expect(result).toBeNull();
  });

  it('should reject "aadhar number" (not a mapped field)', () => {
    const result = fuzzyMatch('aadhar number', 'Aadhar Number', 0.35);
    expect(result).toBeNull();
  });

  it('should reject "passport number" (not a mapped field)', () => {
    const result = fuzzyMatch('passport number', 'Passport Number', 0.35);
    expect(result).toBeNull();
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

  // ── Poison word rejection ──

  it('should NOT structurally match "father\'s first name"', () => {
    const result = structuralMatch("father's first name", "Father's First Name");
    expect(result).toBeNull();
  });

  it('should NOT structurally match "team name"', () => {
    const result = structuralMatch('team name', 'Team Name');
    expect(result).toBeNull();
  });

  it('should NOT structurally match "project name"', () => {
    const result = structuralMatch('project name', 'Project Name');
    expect(result).toBeNull();
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

  // ── Slash-split tests ──

  it('should match "College Name / University" (both parts → academic.college)', () => {
    const result = match('college name / university', 'College Name / University', [], settings);
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.college');
  });

  it('should match "Branch / Stream" (both parts → academic.department)', () => {
    const result = match('branch / stream', 'Branch / Stream', [], settings);
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.department');
  });

  it('should skip "Name / Email" (parts disagree: name.full vs email)', () => {
    const result = match('name / email', 'Name / Email', [], settings);
    expect(result).toBeNull();
  });

  it('should skip "Resume / CV Link" (resume alone is null)', () => {
    const result = match('resume / cv link', 'Resume / CV Link', [], settings);
    expect(result).toBeNull();
  });

  // ── Stop word stripping tests ──

  it('should match "mention your LinkedIn profile URL" (mention is stop word)', () => {
    const result = match('mention your linkedin profile url', 'Mention your LinkedIn profile URL', [], settings);
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.linkedin');
  });

  it('should skip "share your GitHub profile link" (extra word "link" creates noise)', () => {
    // "link" is NOT a stop word (used in resume link patterns), so it stays
    // tokens: ["github", "link", "profile"] ≠ pattern ["github", "profile"]
    const result = match('share your github profile link', 'Share your GitHub profile link', [], settings);
    expect(result).toBeNull();
  });

  it('should match "paste your resume link here" (paste, here are stop words)', () => {
    const result = match('paste your resume link here', 'Paste your resume link here', [], settings);
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('contact.resumeLink');
  });

  // ── Possessive 's cleanup ──

  it('should match "Student\'s Full Name" (possessive s stripped)', () => {
    const result = match("student's full name", "Student's Full Name", [], settings);
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('name.full');
  });

  it('should match "Candidate\'s College Name" (possessive s stripped)', () => {
    const result = match("candidate's college name", "Candidate's College Name", [], settings);
    expect(result).not.toBeNull();
    expect(result!.profileKey).toBe('academic.college');
  });
});

