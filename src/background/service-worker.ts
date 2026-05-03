// ──────────────────────────────────────────────
// Forma — Service Worker (Background Script)
// MV3 event-driven background process
// ──────────────────────────────────────────────

import type { ProfileKeyPath } from '../types/index.js';
import { saveLearnedMapping } from '../core/storage/storageManager.js';
import { checkAiStatus, triggerModelDownload, generateFillMapping } from '../core/ai/aiManager.js';

// Track pending learn candidates for notification responses
const pendingLearnCandidates = new Map<
  string,
  { normalizedLabel: string; resolvedKey: ProfileKeyPath }
>();

// ──────────────────────────────────────────────
// Message Handler
// ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    // ── Popup → Service Worker → Content Script ──
    case 'FORMA_FILL': {
      // Get the active tab and send the fill command to its content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) {
          sendResponse({
            type: 'FORMA_RESULT',
            payload: {
              filledCount: 0,
              skippedCount: 0,
              filledLabels: [],
              skippedLabels: [],
            },
          });
          return;
        }

        chrome.tabs.sendMessage(
          tab.id,
          { type: 'FORMA_FILL' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                '[Forma SW] Content script not reachable, injecting programmatically...',
                chrome.runtime.lastError.message
              );

              // Programmatically inject the content script and retry
              chrome.scripting.executeScript(
                {
                  target: { tabId: tab.id! },
                  files: ['dist/content.js'],
                },
                () => {
                  if (chrome.runtime.lastError) {
                    console.error(
                      '[Forma SW] Script injection failed:',
                      chrome.runtime.lastError.message
                    );
                    sendResponse({
                      type: 'FORMA_RESULT',
                      payload: {
                        filledCount: 0,
                        skippedCount: 0,
                        filledLabels: [],
                        skippedLabels: [],
                        error: 'Could not reach the form page. Make sure you are on a Google Form.',
                      },
                    });
                    return;
                  }

                  // Wait a moment for the content script to initialize
                  setTimeout(() => {
                    chrome.tabs.sendMessage(
                      tab.id!,
                      { type: 'FORMA_FILL' },
                      (retryResponse) => {
                        if (chrome.runtime.lastError) {
                          console.error(
                            '[Forma SW] Retry failed:',
                            chrome.runtime.lastError.message
                          );
                          sendResponse({
                            type: 'FORMA_RESULT',
                            payload: {
                              filledCount: 0,
                              skippedCount: 0,
                              filledLabels: [],
                              skippedLabels: [],
                              error: 'Could not reach the form page. Please refresh and try again.',
                            },
                          });
                          return;
                        }
                        sendResponse(retryResponse);
                      }
                    );
                  }, 300);
                }
              );
              return;
            }

            // Relay the content script's response back to the popup
            sendResponse(response);
          }
        );
      });

      // Async response
      return true;
    }

    // ── Popup → Service Worker → Content Script: Clear Highlights ──
    case 'FORMA_CLEAR_HIGHLIGHTS': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) {
          sendResponse({ success: false });
          return;
        }

        chrome.tabs.sendMessage(
          tab.id,
          { type: 'FORMA_CLEAR_HIGHLIGHTS' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                '[Forma SW] Error clearing highlights:',
                chrome.runtime.lastError.message
              );
            }
            sendResponse(response ?? { success: false });
          }
        );
      });

      return true;
    }

    // ── Content Script → Service Worker: Learn Candidate ──
    case 'FORMA_LEARN_CANDIDATE': {
      const { normalizedLabel, rawLabel, resolvedKey } = message.payload as {
        normalizedLabel: string;
        rawLabel: string;
        enteredValue: string;
        resolvedKey: ProfileKeyPath;
      };

      // Create a notification to ask the user
      const notificationId = `forma-learn-${Date.now()}`;

      pendingLearnCandidates.set(notificationId, {
        normalizedLabel,
        resolvedKey,
      });

      chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'assets/icon128.png',
        title: 'Forma — Save Mapping?',
        message: `Save "${rawLabel}" → ${resolvedKey} for future forms?`,
        buttons: [{ title: 'Yes, Save' }, { title: 'Dismiss' }],
        requireInteraction: true,
      });

      sendResponse({ received: true });
      return false;
    }

    // ── Content Script → Service Worker: Auto-fill Result ──
    case 'FORMA_RESULT': {
      // This comes from the auto-fill-on-load path
      // Just log it for now
      console.debug('[Forma SW] Auto-fill result received:', message.payload);
      return false;
    }

    // ── AI Execution Handlers (Offloaded from Content Script) ──
    case 'FORMA_AI_STATUS_REQUEST': {
      checkAiStatus().then((status) => {
        sendResponse({ status });
      }).catch((err) => {
        console.error('[Forma SW] checkAiStatus error:', err);
        sendResponse({ status: 'unsupported' });
      });
      return true; // async response
    }

    case 'FORMA_AI_MAPPING_REQUEST': {
      const { profile, unmatchedLabels } = message.payload;
      generateFillMapping(profile, unmatchedLabels).then((mapping) => {
        sendResponse({ mapping });
      }).catch((err) => {
        console.error('[Forma SW] generateFillMapping error:', err);
        sendResponse({ mapping: null });
      });
      return true; // async response
    }

    case 'FORMA_AI_DOWNLOAD_REQUEST': {
      triggerModelDownload().then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        console.error('[Forma SW] triggerModelDownload error:', err);
        sendResponse({ success: false });
      });
      return true; // async response
    }

    default:
      return false;
  }
});

// ──────────────────────────────────────────────
// Notification Button Handler
// ──────────────────────────────────────────────

chrome.notifications.onButtonClicked.addListener(
  async (notificationId, buttonIndex) => {
    const candidate = pendingLearnCandidates.get(notificationId);
    if (!candidate) return;

    if (buttonIndex === 0) {
      // "Yes, Save" — persist the learned mapping
      await saveLearnedMapping({
        normalizedLabel: candidate.normalizedLabel,
        profileKey: candidate.resolvedKey,
        savedAt: Date.now(),
      });

      console.debug(
        `[Forma SW] Learned mapping saved: "${candidate.normalizedLabel}" → "${candidate.resolvedKey}"`
      );
    }

    // Clean up
    pendingLearnCandidates.delete(notificationId);
    chrome.notifications.clear(notificationId);
  }
);

// Also handle notification click (dismiss)
chrome.notifications.onClicked.addListener((notificationId) => {
  pendingLearnCandidates.delete(notificationId);
  chrome.notifications.clear(notificationId);
});

console.debug('[Forma SW] Service worker loaded.');
