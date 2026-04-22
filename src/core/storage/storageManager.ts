// ──────────────────────────────────────────────
// Forma — Storage Manager
// Promise-based wrapper around chrome.storage.local
// ──────────────────────────────────────────────

import type { FormaProfile, FormaSettings, LearnedMapping } from '../../types/index.js';
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
 * Get all learned mappings from storage.
 * Returns an empty array if none exist.
 */
export async function getLearnedMappings(): Promise<LearnedMapping[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LEARNED_MAPPINGS);
  return (result[STORAGE_KEYS.LEARNED_MAPPINGS] as LearnedMapping[]) ?? [];
}

/**
 * Save a new learned mapping. Appends to the existing array.
 * If a mapping for the same normalized label already exists, it is replaced.
 */
export async function saveLearnedMapping(mapping: LearnedMapping): Promise<void> {
  const existing = await getLearnedMappings();

  // Replace existing mapping for the same label, or append
  const idx = existing.findIndex(
    (m) => m.normalizedLabel === mapping.normalizedLabel
  );

  if (idx >= 0) {
    existing[idx] = mapping;
  } else {
    existing.push(mapping);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.LEARNED_MAPPINGS]: existing });
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
    STORAGE_KEYS.LEARNED_MAPPINGS,
    STORAGE_KEYS.SETTINGS,
  ]);
}
