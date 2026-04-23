// ──────────────────────────────────────────────
// Forma — Options Page Script
// Profile form: load, validate, save, clear,
// export, import, section nav, completeness
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
  { id: 'resume-link', path: ['contact', 'resumeLink'], required: false },

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
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import') as HTMLButtonElement;
const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;
const backlogCountGroup = document.getElementById('backlog-count-group')!;
const backlogCountInput = document.getElementById('backlog-count') as HTMLInputElement;
const toast = document.getElementById('toast')!;
const toastMessage = document.getElementById('toast-message')!;

// DOB elements
const dobDisplay = document.getElementById('dob-display') as HTMLInputElement;
const dobPicker = document.getElementById('dob') as HTMLInputElement;
const dobCalendarBtn = document.getElementById('dob-calendar-btn') as HTMLButtonElement;

// Section navigation
const navItems = document.querySelectorAll('.nav-item') as NodeListOf<HTMLButtonElement>;
const formSections = document.querySelectorAll('.form-section') as NodeListOf<HTMLDivElement>;

// Scroll container
const contentScroll = document.querySelector('.content-scroll') as HTMLDivElement;

// Completeness ring
const completenessRing = document.getElementById('completeness-ring') as SVGCircleElement;
const completenessPercent = document.getElementById('completeness-percent')!;
const RING_CIRCUMFERENCE = 2 * Math.PI * 20; // r=20 → circumference ≈ 125.66

// Theme toggle
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;

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

// ─── Section Navigation ─────────────────────

function scrollToSection(sectionName: string): void {
  const target = document.getElementById(`section-${sectionName}`);
  if (target) {
    // Use the scroll container, not scrollIntoView (which can fight with overflow)
    const containerTop = contentScroll.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const offset = contentScroll.scrollTop + (targetTop - containerTop);
    contentScroll.scrollTo({ top: offset, behavior: 'smooth' });
  }
}

// Highlight the active nav item based on scroll position
function updateActiveNav(): void {
  const scrollTop = contentScroll.scrollTop;
  let activeName = 'identity'; // default

  formSections.forEach((section) => {
    // Section is "active" if its top has scrolled past the viewport's top zone
    const sectionTop = section.offsetTop - contentScroll.offsetTop;
    if (scrollTop >= sectionTop - 60) {
      activeName = section.dataset.section || activeName;
    }
  });

  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.section === activeName);
  });
}

contentScroll.addEventListener('scroll', updateActiveNav, { passive: true });
// Set initial state
updateActiveNav();

// ─── Profile Completeness ───────────────────

function updateCompleteness(): void {
  // Count filled fields (mapped + DOB + backlog)
  let filled = 0;
  let total = FIELD_MAPPINGS.length + 1; // +1 for DOB

  for (const mapping of FIELD_MAPPINGS) {
    // Skip country code from completeness count — it has a default
    if (mapping.id === 'phone-country-code') {
      total--;
      continue;
    }
    if (getInputValue(mapping.id)) filled++;
  }

  // DOB
  if (dobDisplay.value.trim()) filled++;

  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;

  // Update ring
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
  completenessRing.style.strokeDashoffset = String(offset);

  // Update text
  completenessPercent.textContent = `${percent}%`;
}

// ─── Load Profile ────────────────────────────

async function loadProfile(): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;

  populateFormFromProfile(profile);
}

/**
 * Populates all form fields from a profile object.
 * Used by both loadProfile() and handleImport().
 */
function populateFormFromProfile(profile: FormaProfile): void {
  const profileObj = profile as unknown as Record<string, unknown>;

  // Populate all mapped fields
  for (const mapping of FIELD_MAPPINGS) {
    const value = getNestedValue(profileObj, mapping.path);
    setInputValue(mapping.id, value);
  }

  // Load DOB separately (stored as ISO, display as DD/MM/YYYY)
  if (profile.personal?.dob) {
    dobDisplay.value = isoToDdMmYyyy(profile.personal.dob);
    dobPicker.value = profile.personal.dob;
  } else {
    dobDisplay.value = '';
    dobPicker.value = '';
  }

  // Placement fields (handled separately due to radio)
  if (profile.placement?.activeBacklog) {
    setSelectedBacklog(profile.placement.activeBacklog);
  }
  if (profile.placement?.backlogCount) {
    backlogCountInput.value = profile.placement.backlogCount;
  }

  // Show/hide backlog count
  updateBacklogVisibility();

  // Update completeness
  updateCompleteness();
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
  updateCompleteness();
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
  updateCompleteness();
}

// ─── Export Profile ──────────────────────────

/**
 * Recursively strips empty strings and empty objects
 * to produce a clean, sparse JSON for export.
 */
function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      if (value.length > 0) {
        result[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      const cleaned = stripEmpty(value as Record<string, unknown>);
      if (cleaned !== null) {
        result[key] = cleaned;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function handleExport(): void {
  // Build the profile object from current form state
  const profileObj: Record<string, unknown> = {};

  for (const mapping of FIELD_MAPPINGS) {
    const value = getInputValue(mapping.id);
    if (value) {
      setNestedValue(profileObj, mapping.path, value);
    }
  }

  // DOB
  const dobIso = ddMmYyyyToIso(dobDisplay.value.trim());
  if (dobIso) {
    setNestedValue(profileObj, ['personal', 'dob'], dobIso);
  }

  // Placement
  const backlog = getSelectedBacklog();
  if (backlog) {
    setNestedValue(profileObj, ['placement', 'activeBacklog'], backlog);
  }
  const backlogCount = backlogCountInput.value;
  if (backlogCount && backlogCount !== '0') {
    setNestedValue(profileObj, ['placement', 'backlogCount'], backlogCount);
  }

  // Strip any remaining empties
  const cleaned = stripEmpty(profileObj);

  if (!cleaned || Object.keys(cleaned).length === 0) {
    showToast('Nothing to export — profile is empty.', 'error');
    return;
  }

  // Trigger download
  const json = JSON.stringify(cleaned, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'forma-profile.json';
  a.click();

  URL.revokeObjectURL(url);
  showToast('Profile exported! ✓', 'success');
}

// ─── Import Profile ──────────────────────────

function handleImport(): void {
  // Reset the file input so re-selecting the same file triggers change
  importFileInput.value = '';
  importFileInput.click();
}

function processImportedFile(file: File): void {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const text = reader.result as string;
      const parsed = JSON.parse(text);

      // Basic validation: must be a plain object
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        showToast('Invalid file — expected a JSON object.', 'error');
        return;
      }

      // Build a full profile by merging imported data onto an empty base
      const imported = parsed as Record<string, unknown>;
      const profileObj = imported as unknown as FormaProfile;

      // Populate the form — does NOT auto-save
      populateFormFromProfile(profileObj);

      // Switch to first section so user can review
      scrollToSection('identity');

      showToast('Profile imported — please review and save. ✓', 'success');
    } catch {
      showToast('Could not read file — invalid JSON.', 'error');
    }
  };

  reader.onerror = () => {
    showToast('Error reading file.', 'error');
  };

  reader.readAsText(file);
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
btnExport.addEventListener('click', handleExport);
btnImport.addEventListener('click', handleImport);

// File input change handler for import
importFileInput.addEventListener('change', () => {
  const file = importFileInput.files?.[0];
  if (file) {
    processImportedFile(file);
  }
});

// Section navigation — scroll to section
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const section = item.dataset.section;
    if (section) scrollToSection(section);
  });
});

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
    updateCompleteness();
  }
});

// DOB: Auto-format as user types (insert slashes)
dobDisplay.addEventListener('input', () => {
  let v = dobDisplay.value.replace(/[^0-9/]/g, '');
  // Auto-insert slashes after DD and MM
  if (v.length === 2 && !v.includes('/')) v += '/';
  if (v.length === 5 && v.indexOf('/', 3) === -1) v += '/';
  dobDisplay.value = v;
  updateCompleteness();
});

// Live completeness updates on any input change
form.addEventListener('input', () => {
  updateCompleteness();
});

// ─── Theme ───────────────────────────────────

function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
  const sidebarLogo = document.getElementById('sidebar-logo') as HTMLImageElement | null;
  if (sidebarLogo) {
    sidebarLogo.src = theme === 'dark'
      ? chrome.runtime.getURL('assets/logo-dark.png')
      : chrome.runtime.getURL('assets/logo-light.png');
  }
}

async function loadTheme(): Promise<void> {
  const result = await chrome.storage.local.get('formaTheme');
  const theme = result.formaTheme || 'light';
  applyTheme(theme);
}

async function toggleTheme(): Promise<void> {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await chrome.storage.local.set({ formaTheme: next });
}

themeToggle.addEventListener('click', toggleTheme);

// ─── Initialize ──────────────────────────────

loadTheme();
loadProfile();
