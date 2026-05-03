// ──────────────────────────────────────────────
// Forma — Storage Manager
// Promise-based wrapper around chrome.storage.local
// ──────────────────────────────────────────────

import type { FormaProfile, FormaSettings } from '../../types/index.js';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../../utils/constants.js';

/**
 * Get the user profile from storage.
 * Returns null if no profile has been saved yet.
 */
export async function getProfile(): Promise<FormaProfile | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
  return (result[STORAGE_KEYS.PROFILE] as FormaProfile) ?? null;
}

/**
 * Save the user profile to storage.
 */
export async function saveProfile(profile: FormaProfile): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILE]: profile });
}


/**
 * Get extension settings from storage.
 * Returns defaults for any missing fields.
 */
export async function getSettings(): Promise<FormaSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  const stored = (result[STORAGE_KEYS.SETTINGS] as Partial<FormaSettings>) ?? {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

/**
 * Save extension settings to storage.
 */
export async function saveSettings(settings: FormaSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

/**
 * Clear all Forma data from storage (profile, mappings, settings).
 * Used by the "Clear All Data" button on the options page.
 */
export async function clearAll(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.PROFILE,
    STORAGE_KEYS.SETTINGS,
  ]);
}
