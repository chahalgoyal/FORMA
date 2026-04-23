// ──────────────────────────────────────────────
// Forma — Options Page Script
// Profile form: load, validate, save, clear
// ──────────────────────────────────────────────

import type { FormaProfile } from '../types/index.js';
import { getProfile, saveProfile, clearAll } from '../core/storage/storageManager.js';

// ─── DOM Mappings ────────────────────────────
// Maps DOM input IDs to their profile key paths

interface FieldMapping {
  id: string;
  path: string[];  // nested path into FormaProfile
  required: boolean;
}

const FIELD_MAPPINGS: FieldMapping[] = [
  // Name
  { id: 'name-first', path: ['name', 'first'], required: false },
  { id: 'name-middle', path: ['name', 'middle'], required: false },
  { id: 'name-last', path: ['name', 'last'], required: false },

  // Contact
  { id: 'email-personal', path: ['contact', 'email', 'personal'], required: false },
  { id: 'email-college', path: ['contact', 'email', 'college'], required: false },
  { id: 'email-alternate', path: ['contact', 'email', 'alternate'], required: false },
  { id: 'phone-country-code', path: ['contact', 'phone', 'countryCode'], required: false },
  { id: 'phone-primary', path: ['contact', 'phone', 'primary'], required: false },
  { id: 'phone-alternate', path: ['contact', 'phone', 'alternate'], required: false },
  { id: 'linkedin', path: ['contact', 'linkedin'], required: false },
  { id: 'github', path: ['contact', 'github'], required: false },

  // Personal
  { id: 'gender', path: ['personal', 'gender'], required: false },
  // DOB is handled manually (dob-display ↔ dob hidden picker)

  // Academic
  { id: 'college', path: ['academic', 'college'], required: false },
  { id: 'degree', path: ['academic', 'degree'], required: false },
  { id: 'department', path: ['academic', 'department'], required: false },
  { id: 'enrollment', path: ['academic', 'enrollment'], required: false },
  { id: 'grad-year', path: ['academic', 'gradYear'], required: false },
  { id: 'cgpa', path: ['academic', 'cgpa'], required: false },
  { id: 'grad-percentage', path: ['academic', 'graduationPercentage'], required: false },

  // 10th
  { id: 'tenth-board', path: ['academic', 'tenth', 'board'], required: false },
  { id: 'tenth-percentage', path: ['academic', 'tenth', 'percentage'], required: false },
  { id: 'tenth-year', path: ['academic', 'tenth', 'passingYear'], required: false },

  // 12th
  { id: 'twelfth-board', path: ['academic', 'twelfth', 'board'], required: false },
  { id: 'twelfth-percentage', path: ['academic', 'twelfth', 'percentage'], required: false },
  { id: 'twelfth-year', path: ['academic', 'twelfth', 'passingYear'], required: false },

  // PG
  { id: 'pg-degree', path: ['academic', 'pg', 'degree'], required: false },
  { id: 'pg-percentage', path: ['academic', 'pg', 'percentage'], required: false },
];

// ─── DOM Elements ────────────────────────────

const form = document.getElementById('profile-form') as HTMLFormElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const backlogCountGroup = document.getElementById('backlog-count-group')!;
const backlogCountInput = document.getElementById('backlog-count') as HTMLInputElement;
const toast = document.getElementById('toast')!;
const toastMessage = document.getElementById('toast-message')!;

// DOB elements
const dobDisplay = document.getElementById('dob-display') as HTMLInputElement;
const dobPicker = document.getElementById('dob') as HTMLInputElement;
const dobCalendarBtn = document.getElementById('dob-calendar-btn') as HTMLButtonElement;

// ─── Helpers ─────────────────────────────────

function getInputValue(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  return el?.value?.trim() ?? '';
}

function setInputValue(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (el) el.value = value;
}

function setNestedValue(obj: Record<string, unknown>, path: string[], value: string): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (!(path[i] in current) || typeof current[path[i]] !== 'object') {
      current[path[i]] = {};
    }
    current = current[path[i]] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

function getNestedValue(obj: Record<string, unknown>, path: string[]): string {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : '';
}

function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  toastMessage.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function getSelectedBacklog(): string {
  const selected = document.querySelector(
    'input[name="active-backlog"]:checked'
  ) as HTMLInputElement | null;
  return selected?.value ?? '';
}

function setSelectedBacklog(value: string): void {
  const radio = document.querySelector(
    `input[name="active-backlog"][value="${value}"]`
  ) as HTMLInputElement | null;
  if (radio) radio.checked = true;
}

// ─── DOB Helpers ─────────────────────────────
// Stored as YYYY-MM-DD internally, displayed as DD/MM/YYYY

function isoToDdMmYyyy(iso: string): string {
  if (!iso || !iso.includes('-')) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function ddMmYyyyToIso(display: string): string {
  if (!display || !display.includes('/')) return '';
  const parts = display.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// ─── Load Profile ────────────────────────────

async function loadProfile(): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;

  const profileObj = profile as unknown as Record<string, unknown>;

  // Populate all mapped fields
  for (const mapping of FIELD_MAPPINGS) {
    const value = getNestedValue(profileObj, mapping.path);
    setInputValue(mapping.id, value);
  }

  // Load DOB separately (stored as ISO, display as DD/MM/YYYY)
  if (profile.personal.dob) {
    dobDisplay.value = isoToDdMmYyyy(profile.personal.dob);
    dobPicker.value = profile.personal.dob;
  }

  // Placement fields (handled separately due to radio)
  setSelectedBacklog(profile.placement.activeBacklog);
  backlogCountInput.value = profile.placement.backlogCount;

  // Show/hide backlog count
  updateBacklogVisibility();
}

// ─── Validate ────────────────────────────────
// Soft validation only — no fields are mandatory.
// We only check format constraints when data IS provided.

function validate(): boolean {
  let isValid = true;

  // Clear previous errors
  document.querySelectorAll('.field-error').forEach((el) => {
    el.textContent = '';
  });
  document.querySelectorAll('.field-input.error').forEach((el) => {
    el.classList.remove('error');
  });

  // Soft-validate phone format (only if user entered something)
  const phone = getInputValue('phone-primary');
  if (phone && (phone.length !== 10 || phone.startsWith('0') || !/^\d+$/.test(phone))) {
    const input = document.getElementById('phone-primary');
    const errorEl = document.getElementById('error-phone-primary');
    if (input) input.classList.add('error');
    if (errorEl) errorEl.textContent = 'Must be 10 digits, no leading 0';
    isValid = false;
  }

  return isValid;
}

// ─── Save Profile ────────────────────────────

async function handleSave(e: Event): Promise<void> {
  e.preventDefault();

  if (!validate()) {
    showToast('Please fix the highlighted errors.', 'error');

    // Scroll to first error
    const firstError = document.querySelector('.field-input.error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // Build profile object
  const profileObj: Record<string, unknown> = {};

  for (const mapping of FIELD_MAPPINGS) {
    setNestedValue(profileObj, mapping.path, getInputValue(mapping.id));
  }

  // DOB: convert DD/MM/YYYY display back to ISO for storage
  const dobIso = ddMmYyyyToIso(dobDisplay.value.trim());
  setNestedValue(profileObj, ['personal', 'dob'], dobIso);

  // Add placement fields
  setNestedValue(profileObj, ['placement', 'activeBacklog'], getSelectedBacklog());
  setNestedValue(profileObj, ['placement', 'backlogCount'], backlogCountInput.value || '0');

  await saveProfile(profileObj as unknown as FormaProfile);
  showToast('Profile saved successfully! ✓', 'success');
}

// ─── Clear All Data ──────────────────────────

async function handleClear(): Promise<void> {
  const confirmed = confirm(
    'This will delete all your saved data (profile, learned mappings, and settings). Are you sure?'
  );

  if (!confirmed) return;

  await clearAll();

  // Reset all fields
  form.reset();
  dobDisplay.value = '';
  dobPicker.value = '';
  showToast('All data cleared.', 'success');
}

// ─── Backlog Toggle ──────────────────────────

function updateBacklogVisibility(): void {
  const backlog = getSelectedBacklog();
  if (backlog === 'Yes') {
    backlogCountGroup.style.display = '';
  } else {
    backlogCountGroup.style.display = 'none';
    backlogCountInput.value = '0';
  }
}

// ─── Event Listeners ─────────────────────────

form.addEventListener('submit', handleSave);
btnClear.addEventListener('click', handleClear);

// Listen for backlog radio changes
document.querySelectorAll('input[name="active-backlog"]').forEach((radio) => {
  radio.addEventListener('change', updateBacklogVisibility);
});

// DOB: Calendar button opens the hidden date picker
dobCalendarBtn.addEventListener('click', () => {
  dobPicker.showPicker();
});

// DOB: When a date is picked from the calendar, update the text display
dobPicker.addEventListener('change', () => {
  const iso = dobPicker.value; // YYYY-MM-DD
  if (iso) {
    dobDisplay.value = isoToDdMmYyyy(iso);
  }
});

// DOB: Auto-format as user types (insert slashes)
dobDisplay.addEventListener('input', () => {
  let v = dobDisplay.value.replace(/[^0-9/]/g, '');
  // Auto-insert slashes after DD and MM
  if (v.length === 2 && !v.includes('/')) v += '/';
  if (v.length === 5 && v.indexOf('/', 3) === -1) v += '/';
  dobDisplay.value = v;
});

// ─── Initialize ──────────────────────────────

loadProfile();
