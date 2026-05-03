// ──────────────────────────────────────────────
// Forma — Local AI Orchestrator
// Wraps Chrome's built-in Gemini Nano API
// ──────────────────────────────────────────────

import type { FormaProfile } from '../../types/index.js';

// The API may be exposed under 'ai.languageModel' or 'LanguageModel'
// We use a helper to grab the correct one dynamically.
function getLanguageModelAPI(): any {
  // Always prefer globalThis.ai.languageModel if it exists (Chrome 128+)
  if (typeof (globalThis as any).ai !== 'undefined' && (globalThis as any).ai.languageModel) {
    return (globalThis as any).ai.languageModel;
  }
  // Fallback for older versions
  if (typeof (globalThis as any).LanguageModel !== 'undefined') {
    return (globalThis as any).LanguageModel;
  }
  return null;
}

/**
 * Checks the status of the local AI model.
 * Returns: 'ready', 'downloading', 'needs-download', or 'unsupported'
 */
export async function checkAiStatus(): Promise<'ready' | 'downloading' | 'needs-download' | 'unsupported'> {
  const api = getLanguageModelAPI();
  if (!api) {
    console.debug('[Forma AI] getLanguageModelAPI() returned null.');
    return 'unsupported';
  }

  try {
    // Strategy: Use create() as the primary probe instead of capabilities().
    // capabilities() triggers Chrome's "No output language" warning in the
    // extension error bar regardless of params passed. create() is the ONLY
    // call that properly accepts language params and suppresses the warning.
    //
    // If create() succeeds → model is ready (destroy the session immediately).
    // If create() throws → parse the error to determine download status.
    try {
      const session = await api.create({
        expectedInputLanguages: ['en'],
        expectedOutputLanguages: ['en'],
      });
      // Success — model is ready. Clean up the session immediately.
      if (session && typeof session.destroy === 'function') {
        session.destroy();
      }
      console.debug('[Forma AI] create() succeeded — model is ready.');
      return 'ready';
    } catch (createError: any) {
      const errMsg = String(createError?.message || createError || '').toLowerCase();
      console.debug('[Forma AI] create() probe error:', errMsg);

      // Parse the error message to determine status
      if (errMsg.includes('download') && errMsg.includes('progress')) {
        return 'downloading';
      }
      if (errMsg.includes('after-download') || errMsg.includes('need') || errMsg.includes('not available')) {
        return 'needs-download';
      }
      if (errMsg.includes('download')) {
        return 'needs-download';
      }

      // create() failed for an unknown reason — fall back to capabilities()
      // (accept that this MAY trigger the warning on some builds)
      return await checkViaCapabilities(api);
    }
  } catch (e) {
    console.debug('[Forma AI] Error checking status (suppressed):', e);
    return 'unsupported';
  }
}

/**
 * Fallback: check via capabilities() / availability().
 * Only used if create() fails with an unparseable error.
 */
async function checkViaCapabilities(api: any): Promise<'ready' | 'downloading' | 'needs-download' | 'unsupported'> {
  try {
    let statusObj: any;

    if (typeof api.capabilities === 'function') {
      statusObj = await api.capabilities();
    } else if (typeof api.availability === 'function') {
      statusObj = await api.availability();
    } else {
      return 'unsupported';
    }

    // Handle string responses
    if (typeof statusObj === 'string') {
      if (statusObj === 'no') return 'unsupported';
      if (statusObj === 'readily' || statusObj === 'available') return 'ready';
      if (statusObj === 'after-download' || statusObj === 'downloadable') return 'needs-download';
      if (statusObj === 'downloading') return 'downloading';
      return 'unsupported';
    }

    const available = statusObj.available || statusObj.availability;
    if (available === 'no') return 'unsupported';
    if (available === 'readily' || available === 'available') return 'ready';
    if (available === 'after-download' || available === 'downloadable') return 'needs-download';
    if (available === 'downloading') return 'downloading';

    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/**
 * Forces the browser to start downloading the model.
 */
export async function triggerModelDownload(): Promise<void> {
  const api = getLanguageModelAPI();
  if (!api) return;

  try {
    console.debug('[Forma AI] Sending wake-up signal to register component...');
    // Send a create() call with languages to prevent Chrome from logging a warning
    // This forces Chrome to register the component in chrome://components
    const session = await api.create({
      expectedInputLanguages: ['en'],
      expectedOutputLanguages: ['en'],
    });
    if (session && typeof session.destroy === 'function') {
      session.destroy();
    }
  } catch (e) {
    console.debug('[Forma AI] Wake-up signal sent (Error expected during download):', e);
  }
}

/**
 * Strips the user profile down to only non-empty leaf values.
 * This drastically reduces the prompt size sent to the AI.
 */
function flattenProfile(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' && value.trim() !== '') {
      result[path] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenProfile(value, path));
    }
  }
  return result;
}

/**
 * The core engine. Prompts the AI to map form field labels to the user profile.
 *
 * Optimizations over v1:
 * - Skips the separate "intent verification" call (unnecessary overhead)
 * - Uses a system prompt to set context once, keeping the user prompt lean
 * - Flattens the profile to remove empty values -> smaller prompt -> faster inference
 * - Post-filters the response to strip any hallucinated keys
 */
export async function generateFillMapping(
  profile: FormaProfile,
  labels: string[]
): Promise<Record<string, any> | null> {
  const api = getLanguageModelAPI();
  if (!api) return null;

  const startTime = performance.now();

  try {
    const flatProfile = flattenProfile(profile as unknown as Record<string, any>);

    // Merge custom fields into the flat profile
    if (profile.customFields) {
      for (const cf of profile.customFields) {
        if (cf.label && cf.value) {
          flatProfile[cf.label] = cf.value;
        }
      }
    }

    const BATCH_SIZE = 20;
    const filtered: Record<string, any> = {};
    const relativeKeywords = ['father', 'mother', 'parent', 'guardian', 'emergency'];
    const profileKeys = Object.keys(flatProfile);
    const labelSet = new Set(labels);

    console.debug(`[Forma AI] Processing ${labels.length} fields in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < labels.length; i += BATCH_SIZE) {
      const batchLabels = labels.slice(i, i + BATCH_SIZE);
      
      let session: any;
      try {
        session = await api.create({
          expectedInputLanguages: ['en'],
          expectedOutputLanguages: ['en'],
        });
      } catch (e) {
        console.warn('[Forma AI] Failed to create session for batch:', e);
        continue;
      }

      const promptVersion = 'v5.0 (Key-Mapping)';
      console.debug(`[Forma AI] Sending prompt ${promptVersion} to Nano (Batch ${i / BATCH_SIZE + 1})...`);

      const prompt = `You are a strict data-mapping bot. Match each Form Field to the EXACT KEY from the Profile Keys list. Output ONLY valid JSON.

EXAMPLE PROFILE KEYS:
["name.first", "contact.phone.primary", "contact.email.college", "academic.roll_no", "Father's Name"]

EXAMPLE FORM FIELDS:
["Student Name", "Mother's Phone", "Guardian Email", "Father's Full Name", "Branch Code"]

EXAMPLE EXPECTED OUTPUT:
{"Student Name": "name.first", "Mother's Phone": null, "Guardian Email": null, "Father's Full Name": "Father's Name", "Branch Code": null}
(Notice how fields without a strict semantic match in the Profile Keys are set to literal null.)

Now do the same for the following:

PROFILE KEYS:
${JSON.stringify(profileKeys)}

FORM FIELDS TO MAP:
${JSON.stringify(batchLabels)}

EXPECTED OUTPUT:`;

      // Race the AI prompt against a 60s timeout per batch
      const AI_TIMEOUT_MS = 60_000;
      let response = '';
      try {
        response = await Promise.race([
          session.prompt(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`[Forma AI] Timed out after ${AI_TIMEOUT_MS / 1000}s`)), AI_TIMEOUT_MS)
          ),
        ]);
      } catch (e) {
        console.warn('[Forma AI] Batch timed out or failed:', e);
        session.destroy?.();
        continue;
      }

      if (session && typeof session.destroy === 'function') {
        session.destroy();
      }

      // Clean up markdown fences
      let clean = response.trim();
      if (clean.startsWith('```json')) clean = clean.substring(7);
      if (clean.startsWith('```')) clean = clean.substring(3);
      if (clean.endsWith('```')) clean = clean.substring(0, clean.length - 3);
      clean = clean.trim();

      // Auto-heal truncated JSON (often caused by token limits on large batches)
      if (!clean.endsWith('}')) {
        if (clean.endsWith(',')) {
          clean = clean.substring(0, clean.length - 1) + '}';
        } else {
          clean += '}';
        }
        console.debug('[Forma AI] Auto-healed truncated JSON');
      }

      try {
        const mapping = JSON.parse(clean) as Record<string, any>;
        
        for (const [formField, mappedKey] of Object.entries(mapping)) {
          // 1. Skip if key wasn't in our requested labels
          if (!labelSet.has(formField)) continue;

          // 2. Skip nulls or the string "null"
          if (mappedKey === null || mappedKey === 'null' || mappedKey === '') {
            filtered[formField] = null;
            continue;
          }

          const stringKey = String(mappedKey);

          // 3. STRICT KEY MATCH (No substring hallucinations possible)
          if (!profileKeys.includes(stringKey)) {
            console.debug(`[Forma AI] Rejected hallucinated key for "${formField}": "${stringKey}"`);
            filtered[formField] = null;
            continue;
          }

          // 4. IDENTITY BLEED CHECK (bidirectional)
          const lowerLabel = formField.toLowerCase();
          const lowerKey = stringKey.toLowerCase();
          
          const isRelativeField = relativeKeywords.some(rk => lowerLabel.includes(rk));
          const isRelativeKey = relativeKeywords.some(rk => lowerKey.includes(rk));

          // Block: relative field ← personal key
          if (isRelativeField && !isRelativeKey) {
             console.debug(`[Forma AI] Rejected identity bleed for "${formField}": mapped to key "${stringKey}"`);
             filtered[formField] = null;
             continue;
          }
          // Block: personal field ← relative key
          if (!isRelativeField && isRelativeKey) {
             console.debug(`[Forma AI] Rejected reverse bleed for "${formField}": mapped to key "${stringKey}"`);
             filtered[formField] = null;
             continue;
          }

          // Passed all checks!
          filtered[formField] = flatProfile[stringKey];
        }
      } catch (parseError) {
        console.error('[Forma AI] Failed to parse AI JSON response for batch:', clean);
      }
    }

    const elapsed = Math.round(performance.now() - startTime);
    console.debug(
      `[Forma AI] Mapped ${Object.keys(filtered).length}/${labels.length} fields (${elapsed}ms)`
    );
    return filtered;
  } catch (e) {
    console.error('[Forma AI] Mapping generation failed:', e);
    return null;
  }
}
