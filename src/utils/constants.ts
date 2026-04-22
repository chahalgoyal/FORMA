// ──────────────────────────────────────────────
// Forma — Constants & Static Mappings
// ──────────────────────────────────────────────

import type { StaticMapping, FormaSettings } from '../types/index.js';

// ─── Storage Keys ────────────────────────────

export const STORAGE_KEYS = {
  PROFILE: 'forma_profile',
  LEARNED_MAPPINGS: 'forma_learned_mappings',
  SETTINGS: 'forma_settings',
} as const;

// ─── Highlight CSS Classes ───────────────────

export const HIGHLIGHT_CLASSES = {
  FILLED: 'forma-filled',
  SKIPPED: 'forma-skipped',
} as const;

// ─── Default Settings ────────────────────────

export const DEFAULT_SETTINGS: FormaSettings = {
  autoFillOnLoad: false,
  autoFillDelay: 500,
  fuseThreshold: 0.35,
  highlightFilled: '#f0f4ee',    // Softest Sage
  highlightSkipped: '#fcf6ed',   // Softest Amber
};

// ─── DOM Selectors ───────────────────────────

export const SELECTORS = {
  QUESTION_CONTAINER: [
    'div[data-params]',          // Current Google Forms (2025–2026)
    'div[role="listitem"]',      // Fallback: listitem role
    '.freebirdFormviewerComponentsQuestionBaseRoot', // Legacy fallback
  ],
  QUESTION_LABEL: [
    'div[role="heading"]',       // Stable — Google keeps this for accessibility
  ],
  TEXT_INPUT: 'input[type="text"], input[type="email"], input[type="number"], input[type="date"], textarea, input.whsOnd',
  RADIO_OPTION: 'div[role="radio"]',
  DROPDOWN_CONTAINER: 'div[role="listbox"]',
  DROPDOWN_OPTION: 'div[role="option"]',
} as const;

// ─── Static Mappings ─────────────────────────
// IMPORTANT: Ordered from MOST SPECIFIC to LEAST SPECIFIC.
// Layer 1 (keyword matcher) iterates this array and returns
// the FIRST match. More specific patterns must come before
// generic ones to avoid ambiguity.
//
// E.g., "college name" → academic.college MUST be checked
// before "name" → name.full.

export const STATIC_MAPPINGS: StaticMapping[] = [
  // ── Split Name Fields (most specific) ──────
  {
    key: 'name.first',
    patterns: ['first name', 'given name'],
  },
  {
    key: 'name.middle',
    patterns: ['middle name'],
  },
  {
    key: 'name.last',
    patterns: ['last name', 'surname', 'family name'],
  },

  // ── 10th Standard ──────────────────────────
  {
    key: 'academic.tenth.percentage',
    patterns: [
      '10th percentage', '10th marks', 'ssc percentage',
      'matriculation percentage', 'class x percentage',
      '10th %', '10th grade percentage', 'x percentage',
      'class 10 percentage',
    ],
  },
  {
    key: 'academic.tenth.board',
    patterns: [
      '10th board', 'ssc board', 'class x board',
      'matriculation board', '10th passing board',
    ],
  },
  {
    key: 'academic.tenth.passingYear',
    patterns: [
      '10th passing year', 'ssc year',
      'year of passing 10th', 'class x year', '10th year',
    ],
  },

  // ── 12th Standard ─────────────────────────
  {
    key: 'academic.twelfth.percentage',
    patterns: [
      '12th percentage', '12th marks', 'hsc percentage',
      'intermediate percentage', 'class xii percentage',
      '12th %', 'class 12 percentage', 'xii percentage',
    ],
  },
  {
    key: 'academic.twelfth.board',
    patterns: [
      '12th board', 'hsc board', 'class xii board',
      'intermediate board', '12th passing board',
    ],
  },
  {
    key: 'academic.twelfth.passingYear',
    patterns: [
      '12th passing year', 'hsc year',
      'year of passing 12th', 'class xii year', '12th year',
    ],
  },

  // ── PG ─────────────────────────────────────
  {
    key: 'academic.pg.percentage',
    patterns: [
      'pg percentage', 'post graduation percentage',
      'masters percentage', 'm.tech percentage',
      'post-graduate percentage',
    ],
  },

  // ── Backlog (specific before generic) ──────
  {
    key: 'placement.backlogCount',
    patterns: [
      'number of backlogs', 'no of active backlog',
      'backlog count', 'number of active backlogs',
      'how many backlogs', 'total backlogs',
    ],
  },
  {
    key: 'placement.activeBacklog',
    patterns: [
      'active backlog', 'any active backlog',
      'current backlog', 'pending backlog',
      'do you have a backlog', 'backlog status', 'backlog',
    ],
  },

  // ── Contact — Email (specific before generic) ──
  {
    key: 'contact.email.college',
    patterns: [
      'college email', 'official email', 'university email',
      'institute email', 'college mail', 'college email id',
      'institutional email',
    ],
  },
  {
    key: 'contact.email.personal',
    patterns: [
      'personal email', 'personal mail', 'personal email id',
      'gmail', 'non-college email', 'email (not college)',
      'email id', 'email address', 'email',
    ],
  },

  // ── Contact — Phone ────────────────────────
  {
    key: 'contact.phone.alternate',
    patterns: [
      'alternate phone', 'alternate mobile', 'alternate number',
      'alternate phone number', 'alternate phone no',
      'alternate mobile number', 'alternate mobile no',
      'alternate contact no', 'alternate contact number',
      'secondary phone', 'secondary mobile', 'secondary number',
      'secondary phone number', 'secondary phone no',
      'secondary mobile number', 'secondary mobile no',
      'secondary contact no', 'secondary contact number',
      'other number', 'other phone', 'other mobile',
      'other phone number', 'other contact number',
    ],
  },
  {
    key: 'contact.phone.primary',
    patterns: [
      'phone', 'mobile', 'contact number', 'contact no',
      'phone number', 'phone no', 'mobile number', 'mobile no',
      'primary phone', 'primary mobile',
      'primary phone number', 'primary phone no',
      'primary mobile number', 'primary mobile no',
      'primary contact no', 'primary contact number',
      'calling number', 'whatsapp number',
    ],
  },

  // ── Contact — Social ──────────────────────
  {
    key: 'contact.linkedin',
    patterns: ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin id'],
  },
  {
    key: 'contact.github',
    patterns: ['github', 'github url', 'github profile', 'github id'],
  },

  // ── Personal ───────────────────────────────
  {
    key: 'personal.gender',
    patterns: ['gender', 'sex'],
  },
  {
    key: 'personal.dob',
    patterns: [
      'date of birth', 'dob', 'birth date',
      'date of birth (dd/mm/yyyy)', 'd.o.b',
    ],
  },

  // ── Academic (specific before generic) ─────
  // IMPORTANT: enrollment MUST come before college because
  // "university id" should match enrollment, not college.
  {
    key: 'academic.enrollment',
    patterns: [
      'roll number', 'roll no', 'enrollment',
      'enrollment number', 'registration number',
      'university id', 'university roll',
      'university roll number', 'enrollment id',
      'reg no', 'reg number', 'uid',
    ],
  },
  {
    key: 'academic.college',
    patterns: [
      'college name', 'university name', 'institute',
      'institution', 'institution name', 'college', 'university',
    ],
  },
  {
    key: 'academic.degree',
    patterns: [
      'degree', 'course', 'program', 'qualification',
      'degree program', 'current course',
    ],
  },
  {
    key: 'academic.department',
    patterns: [
      'branch', 'stream', 'department', 'specialization',
      'field of study', 'engineering branch', 'your branch', 'dept',
    ],
  },
  {
    key: 'academic.gradYear',
    patterns: [
      'passing year', 'graduation year', 'year of passing',
      'year of graduation', 'batch', 'expected year',
      'pass out year',
    ],
  },
  {
    key: 'academic.cgpa',
    patterns: ['cgpa', 'gpa', 'cumulative gpa', 'current cgpa', 'sgpa'],
  },
  {
    key: 'academic.graduationPercentage',
    patterns: [
      'graduation percentage', 'ug percentage',
      'b.tech percentage', 'aggregate percentage',
      'current percentage', 'overall percentage',
    ],
  },

  // ── Name (LEAST SPECIFIC — must be last) ───
  // "name" alone is treated as full name.
  // All specific name patterns (college name, first name, etc.)
  // are already matched above.
  {
    key: 'name.full',
    patterns: [
      'full name', 'student name', 'candidate name',
      'applicant name', 'your name', 'participant name',
      'student full name', 'name of student',
      'name of candidate', 'name of applicant', 'name',
    ],
  },
];
