// ──────────────────────────────────────────────
// Forma — Content Script Orchestrator
// Main entry point injected into web forms
// ──────────────────────────────────────────────

import type {
  FormaProfile,
  FormaSettings,
  LearnedMapping,
  FillResult,
  FormaResultPayload,
} from '../types/index.js';
import { getProfile, getLearnedMappings, getSettings } from '../core/storage/storageManager.js';
import { parseFormFields } from './domParser.js';
import { match } from '../core/matcher/index.js';
import { fill } from '../core/filler/index.js';
import { injectHighlightStyles, applyHighlight, clearAllHighlights } from './highlighter.js';
import { attachLearningListeners } from './learningWatcher.js';

/**
 * Waits for input elements to appear in the DOM.
 * SPAs like Microsoft Forms render their fields asynchronously,
 * so our parser may fire before inputs exist.
 * Uses a MutationObserver with a timeout fallback.
 */
function waitForInputs(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    // Check if inputs already exist
    const inputSelector = 'input:not([type="hidden"]), textarea, select, [role="listbox"], [role="radiogroup"]';
    if (document.querySelectorAll(inputSelector).length > 0) {
      resolve();
      return;
    }

    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };

    const observer = new MutationObserver(() => {
      if (document.querySelectorAll(inputSelector).length > 0) {
        done();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout fallback — don't wait forever
    const timer = setTimeout(done, timeoutMs);
  });
}

/**
 * Runs the full autofill pipeline:
 * 1. Load profile, learned mappings, and settings from storage
 * 2. Parse form fields from the DOM
 * 3. Match each field label to a profile key
 * 4. Fill each matched field
 * 5. Apply highlights
 * 6. Attach learning listeners
 * 7. Report results
 */
async function runAutofill(): Promise<FormaResultPayload> {
  console.debug('[Forma] Starting autofill pipeline...');

  // ── Step 1: Load data ──
  const [profile, learnedMappings, settings] = await Promise.all([
    getProfile(),
    getLearnedMappings(),
    getSettings(),
  ]);

  if (!profile) {
    console.warn('[Forma] No profile found. Aborting autofill.');
    return {
      filledCount: 0,
      skippedCount: 0,
      filledLabels: [],
      skippedLabels: [],
    };
  }

  // ── Step 2: Parse form fields (with SPA retry) ──
  let fields = parseFormFields();

  // If no fields found, the page might be a SPA still rendering.
  // Wait for inputs to appear in the DOM, then retry once.
  if (fields.length === 0) {
    console.debug('[Forma] No fields on first pass. Waiting for SPA render...');
    await waitForInputs(5000);
    fields = parseFormFields();
  }

  if (fields.length === 0) {
    console.debug('[Forma] No form fields found on this page.');
    return {
      filledCount: 0,
      skippedCount: 0,
      filledLabels: [],
      skippedLabels: [],
    };
  }

  // ── Step 3 & 4: Match and fill each field ──
  injectHighlightStyles();

  const results: FillResult[] = [];

  for (const field of fields) {
    const matchResult = match(
      field.normalizedLabel,
      field.rawLabel,
      learnedMappings,
      settings
    );

    if (!matchResult) {
      // No match — skip
      applyHighlight(field.container, 'skipped');
      results.push({ rawLabel: field.rawLabel, status: 'skipped' });
      console.debug(`[Forma] "${field.rawLabel}" → no match → skipped`);
      continue;
    }

    // Attempt to fill
    let success: boolean;
    try {
      success = await fill(
        field.inputElements,
        field.inputType,
        matchResult,
        profile,
        settings,
        field.container
      );
    } catch (error) {
      console.warn(
        `[Forma] "${field.rawLabel}" → fill error: ${error instanceof Error ? error.message : 'Unknown'}`
      );
      success = false;
    }

    if (success) {
      applyHighlight(field.container, 'filled');
      results.push({
        rawLabel: field.rawLabel,
        status: 'filled',
        profileKey: matchResult.profileKey,
      });
      console.debug(
        `[Forma] "${field.rawLabel}" → matched "${matchResult.profileKey}" (${matchResult.source}, score: ${matchResult.score}) → filled as ${field.inputType}`
      );
    } else {
      applyHighlight(field.container, 'skipped');
      results.push({ rawLabel: field.rawLabel, status: 'skipped' });
      console.debug(
        `[Forma] "${field.rawLabel}" → matched "${matchResult.profileKey}" but fill failed → skipped`
      );
    }
  }

  // ── Step 6: Attach learning listeners ──
  attachLearningListeners(fields, profile);

  // ── Step 7: Compile results ──
  const filledResults = results.filter((r) => r.status === 'filled');
  const skippedResults = results.filter((r) => r.status === 'skipped');

  const payload: FormaResultPayload = {
    filledCount: filledResults.length,
    skippedCount: skippedResults.length,
    filledLabels: filledResults.map((r) => r.rawLabel),
    skippedLabels: skippedResults.map((r) => r.rawLabel),
  };

  console.debug(
    `[Forma] Autofill complete: ${payload.filledCount} filled, ${payload.skippedCount} skipped`
  );

  return payload;
}

// ──────────────────────────────────────────────
// Message Listener
// ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FORMA_FILL') {
    // Run autofill and send results back
    runAutofill()
      .then((result) => {
        sendResponse({ type: 'FORMA_RESULT', payload: result });
      })
      .catch((error) => {
        console.error('[Forma] Autofill failed:', error);
        sendResponse({
          type: 'FORMA_RESULT',
          payload: {
            filledCount: 0,
            skippedCount: 0,
            filledLabels: [],
            skippedLabels: [],
          },
        });
      });

    // Return true to indicate we will send a response asynchronously
    return true;
  }

  if (message.type === 'FORMA_CLEAR_HIGHLIGHTS') {
    clearAllHighlights();
    sendResponse({ type: 'FORMA_CLEAR_HIGHLIGHTS', payload: { success: true } });
    return false;
  }
});

// ──────────────────────────────────────────────
// Auto-fill on page load (opt-in)
// ──────────────────────────────────────────────

(async () => {
  try {
    const settings = await getSettings();
    const currentHostname = window.location.hostname;
    const isWhitelisted = settings.whitelistedDomains?.includes(currentHostname) ?? false;

    if (settings.autoFillOnLoad && isWhitelisted) {
      console.debug(
        `[Forma] Auto-load triggered for whitelisted domain: ${currentHostname}`
      );

      setTimeout(async () => {
        const result = await runAutofill();

        // Send result to service worker (which may relay to popup)
        try {
          chrome.runtime.sendMessage({
            type: 'FORMA_RESULT',
            payload: result,
          });
        } catch {
          // Extension context invalidated — silently ignore
        }
      }, settings.autoFillDelay);
    }
  } catch (error) {
    console.error('[Forma] Error checking auto-fill settings:', error);
  }
})();

console.debug('[Forma] Content script loaded and ready.');
