// ──────────────────────────────────────────────
// Forma — Shared TypeScript Types
// ──────────────────────────────────────────────

// ─── Profile ─────────────────────────────────

export interface FormaProfile {
  name: {
    first: string;
    middle: string;
    last: string;
  };
  contact: {
    email: {
      personal: string;
      college: string;
      alternate: string;
    };
    phone: {
      countryCode: string;
      primary: string;
      alternate: string;
    };
    linkedin: string;
    github: string;
    resumeLink: string;
  };
  personal: {
    gender: 'Male' | 'Female' | 'Other' | '';
    dob: string;
  };
  academic: {
    college: string;
    degree: string;
    department: string;
    enrollment: string;
    gradYear: string;
    cgpa: string;
    graduationPercentage: string;
    tenth: {
      board: string;
      percentage: string;
      passingYear: string;
    };
    twelfth: {
      board: string;
      percentage: string;
      passingYear: string;
    };
    pg: {
      percentage: string;
      degree: string;
    };
  };
  placement: {
    activeBacklog: 'Yes' | 'No' | '';
    backlogCount: string;
  };
  customFields?: CustomField[];
}

export interface CustomField {
  label: string;
  value: string;
}

// ─── Settings ────────────────────────────────

export interface FormaSettings {
  autoFillOnLoad: boolean;
  autoFillDelay: number;
  fuseThreshold: number;
  highlightFilled: string;
  highlightSkipped: string;
  whitelistedDomains: string[];
  enableAi: boolean;
}

// ─── Learned Mappings ────────────────────────

export interface LearnedMapping {
  normalizedLabel: string;
  profileKey: ProfileKeyPath;
  savedAt: number;
}

// ─── Static Mappings ─────────────────────────

export interface StaticMapping {
  key: ProfileKeyPath;
  patterns: string[];
}

// ─── Matching ────────────────────────────────

export type ConstraintFlag =
  | 'use-personal-email'
  | 'use-college-email'
  | 'use-country-code'
  | 'split-first-name'
  | 'split-last-name'
  | 'split-middle-name';

export interface MatchResult {
  profileKey: ProfileKeyPath;
  score: number;
  source: 'learned' | 'keyword' | 'fuzzy' | 'structural';
  constraint?: ConstraintFlag;
}

// ─── Form Field (DOM) ────────────────────────

export type FieldType = 'text' | 'radio' | 'dropdown';

export interface FormField {
  container?: Element;
  inputElements: Element[];
  rawLabel: string;
  normalizedLabel: string;
  inputType: FieldType;
}

// ─── Fill Result ─────────────────────────────

export interface FillResult {
  rawLabel: string;
  status: 'filled' | 'skipped';
  profileKey?: ProfileKeyPath;
}

// ─── Messaging ───────────────────────────────

export type MessageType =
  | 'FORMA_FILL'
  | 'FORMA_RESULT'
  | 'FORMA_CLEAR_HIGHLIGHTS'
  | 'FORMA_LEARN_CANDIDATE'
  | 'FORMA_LEARN_CONFIRM'
  | 'FORMA_LEARN_DISMISS';

export interface FormaMessage {
  type: MessageType;
  payload?: unknown;
}

export interface FormaResultPayload {
  filledCount: number;
  skippedCount: number;
  filledLabels: string[];
  skippedLabels: string[];
}

export interface FormaLearnCandidatePayload {
  normalizedLabel: string;
  rawLabel: string;
  enteredValue: string;
}

// ─── Profile Key Paths ───────────────────────
// All valid dot-notation paths into the FormaProfile

export type ProfileKeyPath =
  | 'name.first'
  | 'name.middle'
  | 'name.last'
  | 'name.full'
  | 'contact.email.personal'
  | 'contact.email.college'
  | 'contact.email.alternate'
  | 'contact.phone.countryCode'
  | 'contact.phone.primary'
  | 'contact.phone.alternate'
  | 'contact.linkedin'
  | 'contact.github'
  | 'contact.resumeLink'
  | 'personal.gender'
  | 'personal.dob'
  | 'academic.college'
  | 'academic.degree'
  | 'academic.department'
  | 'academic.enrollment'
  | 'academic.gradYear'
  | 'academic.cgpa'
  | 'academic.graduationPercentage'
  | 'academic.tenth.board'
  | 'academic.tenth.percentage'
  | 'academic.tenth.passingYear'
  | 'academic.twelfth.board'
  | 'academic.twelfth.percentage'
  | 'academic.twelfth.passingYear'
  | 'academic.pg.percentage'
  | 'academic.pg.degree'
  | 'placement.activeBacklog'
  | 'placement.backlogCount';
