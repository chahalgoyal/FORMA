// ──────────────────────────────────────────────
// Forma — Options Page Script
// Profile form: load, validate, save, clear,
// export, import, section nav, completeness
// ──────────────────────────────────────────────

import type { FormaProfile, CustomField } from '../types/index.js';
import { getProfile, saveProfile, clearAll, getSettings, saveSettings } from '../core/storage/storageManager.js';

// AI status checks are routed through the service worker via messaging
// to avoid Chrome's "No output language" warning appearing in the
// extensions error panel (it fires in the SW context instead).
async function checkAiStatusViaWorker(): Promise<'ready' | 'downloading' | 'needs-download' | 'unsupported'> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'FORMA_AI_STATUS_REQUEST' });
    return response?.status ?? 'unsupported';
  } catch {
    return 'unsupported';
  }
}

async function triggerModelDownloadViaWorker(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'FORMA_AI_DOWNLOAD_REQUEST' });
  } catch {
    // Silently ignore
  }
}

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
const toastMessage = document.getElementById('toast-message')!;
const whitelistTextarea = document.getElementById('whitelist-textarea') as HTMLTextAreaElement;

// AI Setting elements
const enableAiCheckbox = document.getElementById('enable-ai') as HTMLInputElement;
const aiStatusContainer = document.getElementById('ai-status-container') as HTMLDivElement;
const aiSetupGuide = document.getElementById('ai-setup-guide') as HTMLDivElement;
const customFieldsSection = document.getElementById('custom-fields-section') as HTMLDivElement;
const customFieldsContainer = document.getElementById('custom-fields-container') as HTMLDivElement;
const btnAddCustomField = document.getElementById('btn-add-custom-field') as HTMLButtonElement;
const btnDownloadAiModel = document.getElementById('btn-download-ai-model') as HTMLButtonElement;
const aiDownloadStatus = document.getElementById('ai-download-status') as HTMLDivElement;
const chromeLinkBtns = document.querySelectorAll('.chrome-link-btn');

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
    // Subtract 40px to give the section header breathing room at the top of the view
    const offset = contentScroll.scrollTop + (targetTop - containerTop) - 40;
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
  if (profile) {
    populateFormFromProfile(profile);
  }

  // Load Settings
  const settings = await getSettings();
  if (settings.whitelistedDomains) {
    whitelistTextarea.value = settings.whitelistedDomains.join('\n');
  }
  
  if (settings.enableAi) {
    enableAiCheckbox.checked = true;
  }
  await updateAiStatusUI();
}

// ─── AI Settings Logic ───────────────────────

async function updateAiStatusUI(): Promise<void> {
  const isEnabled = enableAiCheckbox.checked;
  aiStatusContainer.style.display = isEnabled ? 'block' : 'none';
  aiSetupGuide.style.display = 'none';
  customFieldsSection.style.display = 'none';

  if (!isEnabled) return;

  aiStatusContainer.textContent = 'Checking AI Status...';
  aiStatusContainer.style.backgroundColor = 'var(--bg-secondary)';
  aiStatusContainer.style.color = 'var(--text-secondary)';

  const status = await checkAiStatusViaWorker();

  if (status === 'unsupported') {
    // Flags not enabled or Chrome too old
    aiStatusContainer.innerHTML = '❌ <b>AI Unsupported</b>: Your browser needs setup. Follow the guide below.';
    aiStatusContainer.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    aiStatusContainer.style.color = '#b91c1c';
    aiSetupGuide.style.display = 'block';

  } else if (status === 'downloading') {
    // Flags are enabled, Chrome is already downloading in the background
    aiStatusContainer.innerHTML = '⏳ <b>Model Downloading (~2 GB)</b>: Chrome is downloading Gemini Nano. See Step 6 below to force the download if it seems stuck.';
    aiStatusContainer.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
    aiStatusContainer.style.color = '#b45309';
    aiSetupGuide.style.display = 'block';
    // Auto-poll until ready
    startDownloadPoller();

  } else if (status === 'needs-download') {
    // Flags are enabled but download hasn't started yet
    aiStatusContainer.innerHTML = '⬇️ <b>Download Required</b>: Click the button below to start downloading the AI model (~2 GB).';
    aiStatusContainer.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
    aiStatusContainer.style.color = '#b45309';
    aiSetupGuide.style.display = 'block';

  } else if (status === 'ready') {
    aiStatusContainer.innerHTML = '✅ <b>AI Ready</b>: The Semantic Engine is loaded and ready to assist.';
    aiStatusContainer.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
    aiStatusContainer.style.color = '#047857';
    customFieldsSection.style.display = 'block';
  }
}

let _pollTimer: ReturnType<typeof setInterval> | null = null;

function startDownloadPoller(): void {
  // Don't start multiple pollers
  if (_pollTimer) return;
  _pollTimer = setInterval(async () => {
    const status = await checkAiStatusViaWorker();
    if (status === 'ready') {
      clearInterval(_pollTimer!);
      _pollTimer = null;
      await updateAiStatusUI();
    } else if (status === 'unsupported') {
      clearInterval(_pollTimer!);
      _pollTimer = null;
      await updateAiStatusUI();
    }
    // If still 'downloading', keep polling
  }, 15000);
}

enableAiCheckbox.addEventListener('change', updateAiStatusUI);

// Download AI Model button handler
btnDownloadAiModel.addEventListener('click', async () => {
  btnDownloadAiModel.disabled = true;
  btnDownloadAiModel.textContent = '⏳ Checking...';
  aiDownloadStatus.textContent = '';

  const status = await checkAiStatusViaWorker();

  if (status === 'unsupported') {
    btnDownloadAiModel.disabled = false;
    btnDownloadAiModel.textContent = '⚡ Initialize & Wake Up AI';
    aiDownloadStatus.textContent = '❌ API not detected. Make sure both flags are Enabled and you fully restarted Chrome.';
    aiDownloadStatus.style.color = '#b91c1c';
    return;
  }

  if (status === 'ready') {
    aiDownloadStatus.textContent = '✅ Model already downloaded! Refreshing status...';
    aiDownloadStatus.style.color = '#047857';
    await updateAiStatusUI();
    return;
  }

  if (status === 'downloading') {
    btnDownloadAiModel.textContent = '⚡ Waking Up...';
    aiDownloadStatus.innerHTML = '✅ Signal sent! Now go to <code style="background: var(--bg-secondary); padding: 2px 4px; border-radius: 4px;">chrome://components</code> (Step 6).';
    aiDownloadStatus.style.color = '#047857';
    startDownloadPoller();
    return;
  }

  // status === 'needs-download' — trigger it manually
  btnDownloadAiModel.textContent = '⚡ Waking Up...';
  aiDownloadStatus.innerHTML = '✅ Signal sent! Now go to <code style="background: var(--bg-secondary); padding: 2px 4px; border-radius: 4px;">chrome://components</code> (Step 6).';
  aiDownloadStatus.style.color = '#047857';
  await triggerModelDownloadViaWorker();
  startDownloadPoller();
});

// Wire up chrome internal links
chromeLinkBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const url = (e.target as HTMLElement).getAttribute('data-url');
    if (url) {
      chrome.tabs.create({ url });
    }
  });
});

// ─── Custom Fields Logic ─────────────────────

function renderCustomFieldRow(label = '', value = ''): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'field-input';
  labelInput.placeholder = 'Field Name (e.g., Father\'s Name)';
  labelInput.value = label;
  labelInput.style.flex = '1';

  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.className = 'field-input';
  valueInput.placeholder = 'Value';
  valueInput.value = value;
  valueInput.style.flex = '1';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.style.cssText = 'background: none; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; padding: 6px 10px; color: var(--text-secondary); font-size: 14px;';
  removeBtn.addEventListener('click', () => {
    row.remove();
    handleSave(); // Auto-save when a custom field is removed
  });

  row.appendChild(labelInput);
  row.appendChild(valueInput);
  row.appendChild(removeBtn);
  return row;
}

function getCustomFieldsFromUI(): CustomField[] {
  const rows = customFieldsContainer.querySelectorAll('div');
  const fields: CustomField[] = [];
  rows.forEach((row) => {
    const inputs = row.querySelectorAll('input');
    if (inputs.length >= 2) {
      const label = inputs[0].value.trim();
      const value = inputs[1].value.trim();
      if (label && value) {
        fields.push({ label, value });
      }
    }
  });
  return fields;
}

function loadCustomFields(customFields?: CustomField[]): void {
  customFieldsContainer.innerHTML = '';
  if (customFields && customFields.length > 0) {
    for (const cf of customFields) {
      customFieldsContainer.appendChild(renderCustomFieldRow(cf.label, cf.value));
    }
  }
}

btnAddCustomField.addEventListener('click', () => {
  customFieldsContainer.appendChild(renderCustomFieldRow());
});

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

  // Load custom fields
  loadCustomFields(profile.customFields);

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

async function handleSave(e?: Event): Promise<void> {
  if (e) e.preventDefault();

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

  // Add custom fields
  const customFields = getCustomFieldsFromUI();
  const fullProfile = profileObj as unknown as FormaProfile;
  fullProfile.customFields = customFields.length > 0 ? customFields : undefined;

  await saveProfile(fullProfile);

  // Save Settings
  const settings = await getSettings();
  const domains = whitelistTextarea.value
    .split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(line => line.length > 0);
  settings.whitelistedDomains = domains;
  settings.enableAi = enableAiCheckbox.checked;
  await saveSettings(settings);

  // Only show the bright toast if the user explicitly clicked the Save button
  if (e) {
    showToast('Profile and Settings saved successfully! ✓', 'success');
  } else {
    // For auto-saves, show a quieter, brief toast so it's not distracting
    toastMessage.textContent = 'Auto-saved';
    toast.className = 'toast show success';
    setTimeout(() => toast.classList.remove('show'), 1500);
  }
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
function stripEmpty(obj: Record<string, unknown> | unknown[]): any {
  if (Array.isArray(obj)) {
    const arr = obj.map(item => typeof item === 'object' && item !== null ? stripEmpty(item as Record<string, unknown>) : item)
                   .filter(item => item !== null && item !== '');
    return arr.length > 0 ? arr : null;
  }

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

  // Custom Fields
  const customFields = getCustomFieldsFromUI();
  if (customFields && customFields.length > 0) {
    profileObj['customFields'] = customFields;
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

// Explicit Save Button
form.addEventListener('submit', handleSave);

// Auto-Save: Triggers whenever any input loses focus and its value changed,
// or when checkboxes/radios/selects are interacted with.
form.addEventListener('change', () => handleSave());

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
