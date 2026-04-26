// ──────────────────────────────────────────────
// Forma — Local AI Orchestrator
// Wraps Chrome's built-in Gemini Nano API
// ──────────────────────────────────────────────

import type { FormaProfile } from '../../types/index.js';

// The API may be exposed under 'ai.languageModel' or 'LanguageModel'
// We use a helper to grab the correct one dynamically.
function getLanguageModelAPI(): any {
  // Always prefer window.ai.languageModel if it exists (Chrome 128+)
  if (typeof (window as any).ai !== 'undefined' && (window as any).ai.languageModel) {
    return (window as any).ai.languageModel;
  }
  // Fallback for older versions
  if (typeof (window as any).LanguageModel !== 'undefined') {
    return (window as any).LanguageModel;
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
    let statusObj: any;
    // NOTE: capabilities() does NOT accept language params — only create() does.
    // The Chrome warning "No output language was specified" is a platform-level advisory
    // that fires whenever ANY page touches the LanguageModel API. It cannot be suppressed from JS.
    if (typeof api.capabilities === 'function') {
      statusObj = await api.capabilities();
    } else if (typeof api.availability === 'function') {
      statusObj = await api.availability();
    } else {
      console.debug('[Forma AI] Neither capabilities() nor availability() found on API object.', api);
      return 'unsupported';
    }

    console.debug('[Forma AI] capabilities() returned:', statusObj);

    // Handle string responses (some Chrome builds return a raw string)
    if (typeof statusObj === 'string') {
      if (statusObj === 'no') return 'unsupported';
      if (statusObj === 'readily' || statusObj === 'available') return 'ready';
      if (statusObj === 'after-download' || statusObj === 'downloadable') return 'needs-download';
      if (statusObj === 'downloading') return 'downloading';
      return 'unsupported';
    }

    const available = statusObj.available || statusObj.availability;
    console.debug('[Forma AI] Parsed availability state:', available);

    if (available === 'no') return 'unsupported';
    if (available === 'readily' || available === 'available') return 'ready';
    if (available === 'after-download' || available === 'downloadable') return 'needs-download';
    if (available === 'downloading') return 'downloading';

    return 'unsupported';
  } catch (e) {
    console.error('[Forma AI] Error checking status:', e);
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
    await api.create({
      expectedInputLanguage: 'en',
      expectedOutputLanguage: 'en',
    });
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

    const session = await api.create({
      expectedInputLanguage: 'en',
      expectedOutputLanguage: 'en',
    });

    const promptVersion = 'v5.0 (Key-Mapping)';
    console.debug(`[Forma AI] Sending prompt ${promptVersion} to Nano...`);

    const profileKeys = Object.keys(flatProfile);

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
${JSON.stringify(labels)}

EXPECTED OUTPUT:`;

    // Race the AI prompt against a 120s timeout
    const AI_TIMEOUT_MS = 120_000;
    const response = await Promise.race([
      session.prompt(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`[Forma AI] Timed out after ${AI_TIMEOUT_MS / 1000}s`)), AI_TIMEOUT_MS)
      ),
    ]);
    const elapsed = Math.round(performance.now() - startTime);
    console.debug(`[Forma AI] Response received in ${elapsed}ms`);

    // Clean up markdown fences if the model hallucinates them
    let clean = response.trim();
    if (clean.startsWith('\`\`\`json')) clean = clean.substring(7);
    if (clean.startsWith('\`\`\`')) clean = clean.substring(3);
    if (clean.endsWith('\`\`\`')) clean = clean.substring(0, clean.length - 3);
    clean = clean.trim();

    try {
      const mapping = JSON.parse(clean) as Record<string, any>;
      console.debug('[Forma AI] Raw AI response (parsed):', mapping);
      const labelSet = new Set(labels);
      
      const filtered: Record<string, any> = {};
      const relativeKeywords = ['father', 'mother', 'parent', 'guardian', 'emergency'];

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

        // Block: relative field ← personal key (e.g. "Father's Phone" ← contact.phone.primary)
        if (isRelativeField && !isRelativeKey) {
           console.debug(`[Forma AI] Rejected identity bleed for "${formField}": mapped to key "${stringKey}"`);
           filtered[formField] = null;
           continue;
        }
        // Block: personal field ← relative key (e.g. "Your Email" ← Father's Email)
        if (!isRelativeField && isRelativeKey) {
           console.debug(`[Forma AI] Rejected reverse bleed for "${formField}": mapped to key "${stringKey}"`);
           filtered[formField] = null;
           continue;
        }

        // Passed all checks! Get the actual value from the profile using the valid key.
        filtered[formField] = flatProfile[stringKey];
      }

      console.debug(
        `[Forma AI] Mapped ${Object.keys(filtered).length}/${labels.length} fields (${elapsed}ms)`
      );
      return filtered;
    } catch (parseError) {
      console.error('[Forma AI] Failed to parse AI JSON response:', clean);
      return null;
    }
  } catch (e) {
    console.error('[Forma AI] Mapping generation failed:', e);
    return null;
  }
}
