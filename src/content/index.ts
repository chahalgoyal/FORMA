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
import { checkAiStatus, generateFillMapping } from '../core/ai/aiManager.js';

// ──────────────────────────────────────────────
// On-Page Toast Notification
// ──────────────────────────────────────────────

const TOAST_ID = 'forma-page-toast';

function injectToastStyles(): void {
  if (document.getElementById('forma-toast-styles')) return;
  const style = document.createElement('style');
  style.id = 'forma-toast-styles';
  style.textContent = `
    #${TOAST_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      border-radius: 12px;
      opacity: 0;
      transform: translateY(16px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
    }
    #${TOAST_ID}.forma-toast-light {
      background: #fdfbf7;
      color: #4a433a;
      border: 1px solid #dcd7ca;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    }
    #${TOAST_ID}.forma-toast-dark {
      background: #1a1714;
      color: #e8e0d4;
      border: 1px solid #3a3430;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    #${TOAST_ID}.forma-toast-visible {
      opacity: 1;
      transform: translateY(0);
    }
    #${TOAST_ID} .forma-toast-spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(128,128,128,0.2);
      border-top: 2px solid #C08552;
      border-radius: 50%;
      animation: forma-spin 0.7s linear infinite;
    }
    @keyframes forma-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

async function getToastThemeClass(): Promise<string> {
  try {
    const result = await chrome.storage.local.get('formaTheme');
    return result.formaTheme === 'dark' ? 'forma-toast-dark' : 'forma-toast-light';
  } catch {
    return 'forma-toast-dark';
  }
}

async function showPageToast(message: string, type: 'loading' | 'success'): Promise<void> {
  injectToastStyles();
  const themeClass = await getToastThemeClass();

  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    document.body.appendChild(toast);
  }

  // Reset theme classes
  toast.classList.remove('forma-toast-light', 'forma-toast-dark', 'forma-toast-visible');
  toast.classList.add(themeClass);

  const icon = type === 'loading'
    ? '<div class="forma-toast-spinner"></div>'
    : '';

  toast.innerHTML = `${icon}<span>${message}</span>`;

  // Force reflow for re-animation
  void toast.offsetWidth;
  toast.classList.add('forma-toast-visible');

  if (type === 'success') {
    setTimeout(() => {
      toast?.classList.remove('forma-toast-visible');
    }, 4000);
  }
}

function hidePageToast(): void {
  const toast = document.getElementById(TOAST_ID);
  if (toast) toast.classList.remove('forma-toast-visible');
}

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

  // ── Step 3: Match and fill each field (Fuzzy-First) ──
  injectHighlightStyles();

  const results: FillResult[] = [];
  const unmatchedFields: typeof fields = [];

  for (const field of fields) {
    const matchResult = match(
      field.normalizedLabel,
      field.rawLabel,
      learnedMappings,
      settings
    );

    if (!matchResult) {
      // No keyword/fuzzy match — collect for AI pass
      unmatchedFields.push(field);
      continue;
    }

    // Attempt to fill with the v1.2 matcher result
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
      // Keyword matched but fill failed — add to unmatched for AI attempt
      unmatchedFields.push(field);
      console.debug(
        `[Forma] "${field.rawLabel}" → matched "${matchResult.profileKey}" but fill failed → queued for AI`
      );
    }
  }

  // ── Step 4: AI Pass (only for unmatched fields) ──
  if (settings.enableAi && unmatchedFields.length > 0) {
    const aiStatus = await checkAiStatus();
    if (aiStatus === 'ready') {
      console.debug(
        `[Forma AI] Sending ${unmatchedFields.length} unmatched fields to AI...`
      );
      isAiProcessing = true;
      await showPageToast('Forma AI is processing...', 'loading');
      const unmatchedLabels = unmatchedFields.map(f => f.rawLabel);
      const aiMapping = await generateFillMapping(profile, unmatchedLabels);
      isAiProcessing = false;

      if (aiMapping) {
        console.debug('[Forma AI] Received AI mapping:', aiMapping);

        for (const field of unmatchedFields) {
          const aiValue = aiMapping[field.rawLabel];

          if (aiValue != null && typeof aiValue === 'string' && aiValue.trim() !== '') {
            let success: boolean;
            try {
              success = await fill(
                field.inputElements,
                field.inputType,
                aiValue,
                profile,
                settings,
                field.container
              );
            } catch (error) {
              console.warn(
                `[Forma AI] "${field.rawLabel}" → AI fill error: ${error instanceof Error ? error.message : 'Unknown'}`
              );
              success = false;
            }

            if (success) {
              applyHighlight(field.container, 'filled');
              results.push({
                rawLabel: field.rawLabel,
                status: 'filled',
              });
              console.debug(
                `[Forma AI] "${field.rawLabel}" → filled as ${field.inputType} (via AI: "${aiValue}")`
              );
              continue;
            }
          }

          // AI also failed or had no value — mark as skipped
          applyHighlight(field.container, 'skipped');
          results.push({ rawLabel: field.rawLabel, status: 'skipped' });
          console.debug(`[Forma] "${field.rawLabel}" → no match (even with AI) → skipped`);
        }
      } else {
        // AI returned null (parse failure, etc.) — mark all unmatched as skipped
        for (const field of unmatchedFields) {
          applyHighlight(field.container, 'skipped');
          results.push({ rawLabel: field.rawLabel, status: 'skipped' });
          console.debug(`[Forma] "${field.rawLabel}" → no match → skipped`);
        }
      }
    } else {
      // AI not available — mark all unmatched as skipped
      for (const field of unmatchedFields) {
        applyHighlight(field.container, 'skipped');
        results.push({ rawLabel: field.rawLabel, status: 'skipped' });
        console.debug(`[Forma] "${field.rawLabel}" → no match → skipped`);
      }
    }
  } else {
    // AI disabled or nothing unmatched — mark remaining as skipped
    for (const field of unmatchedFields) {
      applyHighlight(field.container, 'skipped');
      results.push({ rawLabel: field.rawLabel, status: 'skipped' });
      console.debug(`[Forma] "${field.rawLabel}" → no match → skipped`);
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

  lastPayload = payload;
  isAiProcessing = false;

  // Show on-page toast with results
  if (payload.filledCount > 0) {
    const totalFields = payload.filledCount + payload.skippedCount;
    await showPageToast(`Forma filled ${payload.filledCount} / ${totalFields} fields`, 'success');
  } else {
    hidePageToast();
  }

  // Broadcast completion so popup can update in real-time
  try {
    chrome.runtime.sendMessage({
      type: 'FORMA_AUTOLOAD_DONE',
      payload,
    });
  } catch {
    // Extension context invalidated — silently ignore
  }

  console.debug(
    `[Forma] Autofill complete: ${payload.filledCount} filled, ${payload.skippedCount} skipped`
  );

  return payload;
}

// ──────────────────────────────────────────────
// Message Listener
// ──────────────────────────────────────────────

let lastPayload: FormaResultPayload | null = null;
let isAiProcessing = false;

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
    lastPayload = null;
    sendResponse({ type: 'FORMA_CLEAR_HIGHLIGHTS', payload: { success: true } });
    return false;
  }

  if (message.type === 'FORMA_GET_STATUS') {
    sendResponse({ type: 'FORMA_RESULT', payload: lastPayload, isAiProcessing });
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
        await runAutofill();
      }, settings.autoFillDelay);
    }
  } catch (error) {
    console.error('[Forma] Error checking auto-fill settings:', error);
  }
})();

console.debug('[Forma] Content script loaded and ready.');
