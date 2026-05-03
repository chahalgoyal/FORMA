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
const toggleTheme = document.getElementById('toggle-theme') as HTMLButtonElement;
const btnOptions = document.getElementById('btn-options') as HTMLAnchorElement;
const popupLogo = document.getElementById('popup-logo') as HTMLImageElement;
const whitelistRow = document.getElementById('whitelist-row') as HTMLDivElement;
const btnWhitelist = document.getElementById('btn-whitelist') as HTMLButtonElement;

// ─── State ───────────────────────────────────

let isValidWebpage = false;
let hasProfile = false;
let currentHostname = '';
let isWhitelisted = false;

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

  // Check if we're on a valid webpage (not chrome://)
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    isValidWebpage = (tab?.url?.startsWith('http') || tab?.url?.startsWith('file://')) ?? false;
    if (isValidWebpage && tab?.url) {
      currentHostname = new URL(tab.url).hostname;
    }
  } catch {
    isValidWebpage = false;
  }

  // Update button state
  if (!hasProfile) {
    btnAutofill.disabled = true;
    btnAutofill.title = 'Set up your profile first';
  } else if (!isValidWebpage) {
    btnAutofill.disabled = true;
    notOnForm.classList.remove('hidden');
  } else {
    btnAutofill.disabled = false;
  }

  // Load settings
  const settings = await getSettings();
  toggleAutofill.checked = settings.autoFillOnLoad;

  // Manage Whitelist UI
  if (isValidWebpage && currentHostname) {
    whitelistRow.style.display = 'flex';
    isWhitelisted = settings.whitelistedDomains?.includes(currentHostname) ?? false;
    updateWhitelistButtonUI();
  } else {
    whitelistRow.style.display = 'none';
  }

  // Load theme
  const themeResult = await chrome.storage.local.get('formaTheme');
  const theme = themeResult.formaTheme || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateLogo(theme);

  // Check if an autoload already completed and fetch stats
  if (isValidWebpage) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'FORMA_GET_STATUS' });
        if (response && response.type === 'FORMA_RESULT' && response.payload) {
          showResults(response.payload);
        }
        // If AI is currently processing, show the loader
        if (response && response.isAiProcessing) {
          const aiLoader = document.getElementById('ai-loader')!;
          aiLoader.classList.remove('hidden');
        }
      }
    } catch (e) {
      // Content script might not be injected yet
    }
  }
}

// ─── Real-Time Listener ─────────────────────
// Listens for broadcasts from the content script when
// autofill completes (e.g. during autoload). This replaces
// the old polling approach with instant updates.

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'FORMA_AUTOLOAD_DONE' && message.payload) {
    // Hide AI loader and show results instantly
    const aiLoader = document.getElementById('ai-loader');
    if (aiLoader) aiLoader.classList.add('hidden');
    showResults(message.payload as FormaResultPayload);
  }
});

// ─── Event Handlers ─────────────────────────

// Autofill button
btnAutofill.addEventListener('click', async () => {
  if (!hasProfile || !isValidWebpage) return;

  // Show loading state
  btnAutofill.classList.add('loading');
  btnAutofill.textContent = 'Filling...';
  btnAutofill.disabled = true;

  // Show AI loader if AI is enabled
  const aiLoader = document.getElementById('ai-loader')!;
  const settings = await getSettings();
  if (settings.enableAi) {
    aiLoader.classList.remove('hidden');
  }

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

  // Hide AI loader
  aiLoader.classList.add('hidden');

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

// Whitelist toggle
btnWhitelist.addEventListener('click', async () => {
  if (!currentHostname) return;
  const settings = await getSettings();
  const list = settings.whitelistedDomains || [];

  if (isWhitelisted) {
    settings.whitelistedDomains = list.filter(d => d !== currentHostname);
    isWhitelisted = false;
  } else {
    if (!list.includes(currentHostname)) {
      list.push(currentHostname);
    }
    settings.whitelistedDomains = list;
    isWhitelisted = true;
  }

  await saveSettings(settings);
  updateWhitelistButtonUI();
});

// Edit Profile link
btnOptions.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Dark mode toggle (button, not checkbox)
toggleTheme.addEventListener('click', async () => {
  const current = document.documentElement.getAttribute('data-theme');
  const theme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  updateLogo(theme);
  await chrome.storage.local.set({ formaTheme: theme });
});

// ─── Helpers ─────────────────────────────────

function updateLogo(theme: string): void {
  popupLogo.src = theme === 'dark'
    ? chrome.runtime.getURL('assets/logo-dark.png')
    : chrome.runtime.getURL('assets/logo-light.png');
}

function updateWhitelistButtonUI(): void {
  if (isWhitelisted) {
    btnWhitelist.textContent = 'Disable Auto-Load for this site';
    btnWhitelist.classList.replace('btn-secondary', 'btn-primary');
    btnWhitelist.style.backgroundColor = '#cc0000';
  } else {
    btnWhitelist.textContent = 'Enable Auto-Load for this site';
    btnWhitelist.classList.replace('btn-primary', 'btn-secondary');
    btnWhitelist.style.backgroundColor = '';
  }
}

async function showResults(result: FormaResultPayload): Promise<void> {
  filledCount.textContent = String(result.filledCount);
  skippedCount.textContent = String(result.skippedCount);
  resultsArea.classList.remove('hidden');

  // Show AI Warning if AI is enabled
  const settings = await getSettings();
  const aiWarning = document.getElementById('ai-warning');
  if (aiWarning) {
    aiWarning.style.display = settings.enableAi ? 'block' : 'none';
  }
}

// ─── Run ─────────────────────────────────────

initialize();
