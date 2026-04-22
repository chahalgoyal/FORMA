// ──────────────────────────────────────────────
// Forma — Popup Script
// Manages the popup UI, sends messages, displays results
// ──────────────────────────────────────────────

import type { FormaResultPayload } from '../types/index.js';
import { getProfile, getSettings, saveSettings } from '../core/storage/storageManager.js';
import { DEFAULT_SETTINGS } from '../utils/constants.js';

// ─── DOM Elements ────────────────────────────

const profileIndicator = document.getElementById('profile-indicator')!;
const profileText = document.getElementById('profile-text')!;
const btnAutofill = document.getElementById('btn-autofill') as HTMLButtonElement;
const resultsArea = document.getElementById('results-area')!;
const filledCount = document.getElementById('filled-count')!;
const skippedCount = document.getElementById('skipped-count')!;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const notOnForm = document.getElementById('not-on-form')!;
const toggleAutofill = document.getElementById('toggle-autofill') as HTMLInputElement;
const btnOptions = document.getElementById('btn-options') as HTMLAnchorElement;

// ─── State ───────────────────────────────────

let isOnGoogleForm = false;
let hasProfile = false;

// ─── Initialization ─────────────────────────

async function initialize(): Promise<void> {
  // Check if profile exists
  const profile = await getProfile();
  hasProfile = profile !== null;

  if (hasProfile) {
    profileIndicator.classList.add('complete');
    profileText.textContent = 'Profile: Complete';
  } else {
    profileIndicator.classList.add('incomplete');
    profileText.textContent = 'Profile: Incomplete — click Edit Profile';
  }

  // Check if we're on a Google Form
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    isOnGoogleForm = tab?.url?.includes('docs.google.com/forms') ?? false;
  } catch {
    isOnGoogleForm = false;
  }

  // Update button state
  if (!hasProfile) {
    btnAutofill.disabled = true;
    btnAutofill.title = 'Set up your profile first';
  } else if (!isOnGoogleForm) {
    btnAutofill.disabled = true;
    notOnForm.classList.remove('hidden');
  } else {
    btnAutofill.disabled = false;
  }

  // Load settings
  const settings = await getSettings();
  toggleAutofill.checked = settings.autoFillOnLoad;
}

// ─── Event Handlers ─────────────────────────

// Autofill button
btnAutofill.addEventListener('click', async () => {
  if (!hasProfile || !isOnGoogleForm) return;

  // Show loading state
  btnAutofill.classList.add('loading');
  btnAutofill.textContent = 'Filling...';
  btnAutofill.disabled = true;

  try {
    // Send fill command through service worker
    const response = await chrome.runtime.sendMessage({ type: 'FORMA_FILL' });

    if (response?.payload) {
      const result = response.payload as FormaResultPayload;
      showResults(result);
    } else {
      showResults({
        filledCount: 0,
        skippedCount: 0,
        filledLabels: [],
        skippedLabels: [],
      });
    }
  } catch (error) {
    console.error('[Forma Popup] Autofill error:', error);
    showResults({
      filledCount: 0,
      skippedCount: 0,
      filledLabels: [],
      skippedLabels: [],
    });
  }

  // Reset button
  btnAutofill.classList.remove('loading');
  btnAutofill.innerHTML = `
    <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/>
    </svg>
    Autofill This Form
  `;
  btnAutofill.disabled = false;
});

// Clear highlights button
btnClear.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'FORMA_CLEAR_HIGHLIGHTS' });
    resultsArea.classList.add('hidden');
  } catch (error) {
    console.error('[Forma Popup] Clear highlights error:', error);
  }
});

// Auto-fill toggle
toggleAutofill.addEventListener('change', async () => {
  const settings = await getSettings();
  settings.autoFillOnLoad = toggleAutofill.checked;
  await saveSettings(settings);
});

// Edit Profile link
btnOptions.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ─── Helpers ─────────────────────────────────

function showResults(result: FormaResultPayload): void {
  filledCount.textContent = String(result.filledCount);
  skippedCount.textContent = String(result.skippedCount);
  resultsArea.classList.remove('hidden');
}

// ─── Run ─────────────────────────────────────

initialize();
