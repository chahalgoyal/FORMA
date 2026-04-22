# Software Requirements Specification (SRS)
## Forma — Smart Placement Form Autofill Extension

| Field | Value |
|---|---|
| Document Version | 1.0.0 |
| Status | Draft — Ready for Development |
| Date | April 2026 |
| Scope | Prototype (v1) — Chrome Extension |
| Target Platform | Google Chrome (Manifest V3) |
| Target Domain | `https://docs.google.com/forms/*` |

---

## Table of Contents

1. Introduction
2. Overall Description
3. System Features — Functional Requirements
4. Non-Functional Requirements
5. Data Model
6. System Architecture
7. Matching Engine Design
8. Field Filling Logic
9. DOM Interaction Patterns
10. UI/UX Specification
11. Learning Workflow
12. Error Handling
13. Testing Strategy
14. Project Structure
15. Deployment
16. Future Scope
- Appendix A: Full Static Mapping Table
- Appendix B: Sample Profile JSON
- Appendix C: Message Protocol Reference

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification defines all requirements, architecture decisions, data models, and implementation guidelines for **Forma** — a Chrome browser extension designed to intelligently autofill Google Forms for students participating in campus placement and internship drives.

This document serves as the single source of truth for development. Any developer reading this document should be able to build the system without further clarification, except for minor implementation-level choices.

### 1.2 Intended Audience

This document is written for the sole developer of this project. It assumes familiarity with JavaScript/TypeScript, basic browser extension concepts, and the DOM API. No prior knowledge of NLP or fuzzy search libraries is assumed — all relevant concepts are explained inline.

### 1.3 Product Scope

**Forma** solves a specific, repeated problem: students at institutions like Chandigarh Group of Colleges (CGC) and Chandigarh University (CU) fill out near-identical Google Forms for every placement drive — same fields, slightly different labels, every time.

Forma stores the student's profile once and uses a three-layer matching engine to intelligently map form question labels to the correct profile fields. It then fills text inputs, selects radio buttons, and picks dropdown options — leaving visually highlighted feedback about what it filled and what it skipped.

Forma is not a full-automation tool. It is a smart assistant. It fills only what it is highly confident about and leaves the rest for the user to handle manually.

**In Scope for v1:**
- Autofilling Google Forms at `https://docs.google.com/forms/*`
- Placement-relevant fields: name, contact, academic records, placement data, personal info
- Field types: text input, radio button, dropdown (listbox)
- A popup UI for triggering autofill and viewing results
- A full options page for profile management
- Local persistent storage via `chrome.storage.local`
- An adaptive learning system (user-confirmed, globally scoped)
- Highlighting feedback (green/yellow) and a summary count

**Out of Scope for v1:**
- Any non-Google-Forms website
- File uploads, image uploads, date pickers, CAPTCHAs
- Multi-page form auto-advancement (handled naturally by page reload)
- Backend, cloud sync, or any network requests
- Multi-user or shared profiles
- A UI to manage learned mappings (deferred to v2)
- Preview-before-fill confirmation step (deferred to v2)
- Support for Edge or Brave (deferred; evaluate post-v1)

### 1.4 Definitions and Key Terms

| Term | Meaning |
|---|---|
| Profile | The structured JSON object containing all user data stored locally |
| Label | The visible question text on a Google Form (e.g., "Student Full Name") |
| Mapping | A relationship between a label pattern and a profile field key |
| Static Mapping | A hardcoded mapping baked into the extension code |
| Learned Mapping | A mapping saved at runtime via user confirmation |
| Confidence Score | Fuse.js match score (0 = perfect, 1 = no match); lower is better |
| Threshold | The maximum acceptable confidence score for a match to be acted on |
| Field Type | The UI component of a form input: text, radio, or dropdown |
| Content Script | Extension code injected into the form page |
| Service Worker | The Manifest V3 background process |
| Popup | The small UI that appears when the extension icon is clicked |
| Options Page | The full-page UI for managing the user profile |

### 1.5 Naming

The extension is named **Forma**, derived from the Latin word for *form* or *shape*. The name is simple, non-technical, and directly descriptive of its function.

---

## 2. Overall Description

### 2.1 Product Perspective

Forma is a standalone Chrome extension. It has no backend, no server, and no external dependencies at runtime. All computation happens client-side inside the browser. The only external library used is Fuse.js (bundled into the extension at build time — it never makes a network call).

The extension operates exclusively on Google Forms pages. It does not touch any other website.

### 2.2 High-Level Product Functions

At a high level, Forma does the following:

- Stores a rich student profile once, via the options page
- When the user visits a Google Form and clicks "Autofill" in the popup, it reads all question labels on the form
- It runs each label through a three-layer matching engine to find the best profile field to use
- It fills the appropriate input (text, radio, or dropdown) using the matched value
- It highlights each field green (filled) or yellow (skipped) and reports a summary
- It detects when the user manually corrects a field and optionally saves that as a learned mapping

### 2.3 User Characteristics

The primary user is a final-year engineering student (6th/7th/8th semester) who fills repetitive placement forms frequently. They are comfortable with browsers and extensions but are not expected to understand technical internals. The UI must be simple enough to require no documentation to use.

### 2.4 Operating Environment

- Browser: Google Chrome (latest stable)
- Extension manifest: Manifest V3
- Language: TypeScript (compiled to JavaScript via esbuild)
- Storage: `chrome.storage.local` (no quota concerns — total profile data is under 50KB)
- Target URL: `https://docs.google.com/forms/*`

### 2.5 Design Constraints

- No remote code execution. All scripts are bundled locally (Manifest V3 CSP requirement).
- No external API calls at runtime. Not even to fetch Fuse.js — it is bundled.
- No broad host permissions. The extension only operates on `docs.google.com`.
- TypeScript must be compiled before loading. A build step (esbuild) is required.
- The extension must not crash the Google Form page under any circumstance.

### 2.6 Assumptions

- Google Forms' DOM structure is reasonably stable. If Google significantly changes their markup, the DOM queries may need updating — this is an accepted risk.
- Multi-page Google Forms reload the browser page when "Next" is clicked. Therefore, the content script re-runs on each page naturally, and multi-page handling requires no special logic.
- The user has only one set of personal data (no multiple profile support in v1).
- All placement forms are in English.

---

## 3. System Features — Functional Requirements

### FR-1: User Profile Management

**FR-1.1** The extension shall provide a dedicated full-page Options page (accessible via the popup or `chrome://extensions`) where the user can enter, edit, and save their profile data.

**FR-1.2** The profile must cover all fields defined in Section 5.1 (the full data model). Each field shall have a labeled input on the options page.

**FR-1.3** The options page must validate that at minimum `name.first`, `name.last`, and `phone.primary` are non-empty before saving. If validation fails, it must display inline error messages next to the offending fields and prevent saving.

**FR-1.4** The profile must be persisted to `chrome.storage.local` under the key `forma_profile`.

**FR-1.5** The options page must have a "Save" button and a "Clear All Data" button. Clear All Data must ask for confirmation before deleting.

**FR-1.6** On opening the options page, it must pre-populate all fields from the currently saved profile (if any exists).

---

### FR-2: Content Script Injection

**FR-2.1** A content script shall be declared in `manifest.json` to automatically inject into all pages matching `https://docs.google.com/forms/*`.

**FR-2.2** The content script runs in an isolated world (Chrome default), meaning it shares the DOM but not the JavaScript scope with the page.

**FR-2.3** On injection, the content script does NOT automatically fill the form unless the "Autofill on page load" setting is enabled (see FR-8). It only sets up event listeners.

**FR-2.4** The content script must listen for messages from the service worker on the `chrome.runtime.onMessage` channel, specifically for the message type `"FORMA_FILL"`.

---

### FR-3: Form Detection and Parsing

**FR-3.1** When a fill request is received, the content script must scan the currently visible DOM for all form question containers.

**FR-3.2** Google Forms renders each question inside a container with the class `freebirdFormviewerComponentsQuestionBaseRoot`. The content script must use this class (or the closest stable equivalent selector, see Section 9) to identify question blocks.

**FR-3.3** Within each question container, the content script must extract the label text from the element with role `"heading"` or class `freebirdFormviewerComponentsQuestionBaseTitle`.

**FR-3.4** The extracted label must be normalized before matching: trimmed of whitespace, lowercased, and stripped of asterisks (which Google Forms appends to required questions).

**FR-3.5** For each question container, the content script must also identify the input type: text input (`<input>` or `<textarea>`), radio group (`div[role="radio"]`), or dropdown (`div[role="listbox"]`).

**FR-3.6** If a question container has no recognizable input element, it must be silently skipped (it may be a section header or description block).

---

### FR-4: Field Matching Engine

**FR-4.1** For each normalized label, the matching engine must attempt to find the best matching profile field. The engine runs three layers in sequence, stopping at the first confident match.

**FR-4.2** The matching process is described in full detail in Section 7.

**FR-4.3** The result of matching is either a profile key path string (e.g., `"name.full"`, `"academic.department"`) with a confidence score, or a null result meaning no match found.

**FR-4.4** A match is considered "confident" if the Fuse.js score is below the configured threshold (default: `0.35`). Matches at or above the threshold are treated as no-match.

**FR-4.5** Learned mappings are checked before the static matching engine. If an exact normalized label exists in `forma_learned_mappings`, that mapping is used directly with confidence 1.0 (perfect, no fuzzy check needed).

---

### FR-5: Field Filling

**FR-5.1** For a matched field with a confident score, the extension must fill the appropriate input based on the field type identified in FR-3.5.

**FR-5.2** Filling behavior per type is specified fully in Section 8.

**FR-5.3** If filling fails at the DOM level (element not found, event dispatch error, option not found in dropdown), the field must be counted as skipped, not filled. Any partially set value must be cleared.

**FR-5.4** A "filled" field is defined as one where the value was set in the DOM AND the relevant DOM event was dispatched successfully without error.

**FR-5.5** The extension must support the "intent-first" filling approach: match the semantic intent of the label first (e.g., "college"), then adapt the filling behavior to the input type (text vs. radio vs. dropdown), as described in Section 8.4.

---

### FR-6: Feedback and Highlighting

**FR-6.1** After filling, the content script must visually highlight each question container:
- Green background (`#d4edda`) for filled fields
- Yellow/amber background (`#fff3cd`) for skipped fields (both unmatched and matched-but-failed)

**FR-6.2** Highlights must be applied by adding a CSS class (injected via a `<style>` tag into the page `<head>`), not via inline styles on each element individually.

**FR-6.3** The popup must display a summary after autofill completes: `"X fields filled, Y skipped."` where X and Y are the respective counts received from the content script.

**FR-6.4** The popup must have a "Clear Highlights" button that sends a message to the content script to remove all highlight classes from the page.

**FR-6.5** Highlights must persist on the page until the user clicks "Clear Highlights" or navigates away (page unload).

---

### FR-7: Learning System

**FR-7.1** The content script must attach `blur` and `change` event listeners to all autofill-targeted input elements after filling.

**FR-7.2** If the user manually changes the value of a filled or skipped field and then blurs the input, the content script must send a `"FORMA_LEARN_CANDIDATE"` message to the service worker containing the normalized label text and the new value entered.

**FR-7.3** Upon receiving this message, the service worker must instruct the popup (if open) or use `chrome.notifications` to display a prompt: `"Save the mapping for '[label]' for future forms?"` with "Yes" and "Dismiss" options.

**FR-7.4** If the user confirms "Yes," the service worker must look up which profile key corresponds to the value the user entered (reverse lookup), and save the mapping `{ normalizedLabel → profileKey }` into `forma_learned_mappings` in storage.

**FR-7.5** If the user's entered value does not match any known profile field value, the learn prompt must not appear. Only mappings that can be resolved to a known profile field are learned.

**FR-7.6** All learned mappings are globally scoped — they apply to any Google Form visited in the future, not just the current URL. This is appropriate because the user's target scope is college placement forms, which have low semantic diversity.

**FR-7.7** Learned mappings supplement static mappings. If both exist for a label, the learned mapping takes priority.

---

### FR-8: Popup UI

**FR-8.1** Clicking the extension icon opens a popup of approximately 320px × 420px.

**FR-8.2** The popup must contain the following elements:
- Extension name ("Forma") and a short tagline
- "Autofill This Form" primary button (disabled if no profile is saved)
- A status/summary area showing results after autofill
- "Clear Highlights" button
- A toggle for "Autofill on page load" (opt-in, default OFF)
- A link that opens the Options page
- A note showing profile completion status (e.g., "Profile: Complete" or "Profile: Incomplete — please fill your data")

**FR-8.3** "Autofill This Form" must send a `"FORMA_FILL"` message to the service worker, which relays it to the active tab's content script.

**FR-8.4** The popup must not inject any UI elements into the Google Form page. All feedback is contained within the popup.

**FR-8.5** The "Autofill on page load" toggle state must be persisted in `chrome.storage.local` under `forma_settings.autoFillOnLoad`.

---

### FR-9: Autofill on Page Load (Opt-In)

**FR-9.1** If `forma_settings.autoFillOnLoad` is `true`, the content script must automatically trigger the fill process 500ms after the page DOM is ready (to allow Google Forms to finish rendering its dynamic content).

**FR-9.2** The delay of 500ms is configurable via `forma_settings.autoFillDelay` (stored in settings, default 500).

**FR-9.3** Re-scanning on each page load handles multi-page Google Forms naturally, since Google Forms reloads the page when the user navigates to the next section.

---

### FR-10: Permissions

**FR-10.1** The manifest must declare the following permissions only:
- `"storage"` — for `chrome.storage.local`
- `"activeTab"` — for scripting into the active tab on popup button click
- `"scripting"` — for `chrome.scripting.executeScript` from the service worker
- `"notifications"` — for the learning system prompt

**FR-10.2** Host permissions must be limited to `"https://docs.google.com/forms/*"`.

**FR-10.3** No other permissions may be requested. In particular, `"tabs"`, `"webRequest"`, `"<all_urls>"`, or any broad host patterns are explicitly forbidden.

---

## 4. Non-Functional Requirements

### NFR-1: Performance

Autofill execution (from button click to highlights appearing) must complete in under one second for forms with up to 25 visible fields. This is achievable because:
- All data is already in memory (loaded from storage on content script injection)
- Fuse.js operates on a small static list (under 40 items)
- DOM operations are batched

### NFR-2: Reliability and Accuracy

The system prioritizes correctness over coverage. It is strictly better to skip a field than to fill it incorrectly. A wrong autofill is more disruptive to the user than a skipped one. This principle governs all threshold and fallback decisions throughout the matching engine.

### NFR-3: Privacy

No user data leaves the browser. No network requests are made at runtime. The extension does not use analytics, telemetry, or any remote service. All data lives in `chrome.storage.local`, which is sandboxed per extension.

### NFR-4: Security

- Content scripts run in isolated worlds (no access to page JS scope)
- No use of `eval`, `innerHTML` for script execution, or `document.write`
- No remote script loading (all assets bundled)
- Profile data is not encrypted (it contains no passwords or financial data, only academic information)
- The extension follows Chrome's Content Security Policy requirements for Manifest V3

### NFR-5: Maintainability

The codebase must follow a modular architecture where each concern (matching, filling, storage, UI, learning) is handled by a separate module with a clear interface. No module may directly import from another module's internals. Communication flows through defined interfaces (TypeScript types).

The architecture is designed to be plugin-ready for future extensibility — new field types, new form parsers, or new matching strategies can be added without modifying core modules.

### NFR-6: Usability

A first-time user should be able to set up their profile and run their first autofill in under three minutes without reading any documentation.

---

## 5. Data Model

### 5.1 User Profile Schema

The full profile is stored as a single JSON object under the key `forma_profile`. All fields are strings unless noted. Fields marked `(optional)` may be empty strings. Fields marked `(computed)` are not stored — they are derived at runtime.

```typescript
interface FormaProfile {
  name: {
    first: string;            // "Chahal"
    middle: string;           // "" (optional)
    last: string;             // "Goyal"
    // full: (computed) = [first, middle, last].filter(Boolean).join(" ")
  };

  contact: {
    email: {
      personal: string;       // "chahal@gmail.com"
      college: string;        // "chahal@cgc.edu.in" (optional)
      alternate: string;      // "" (optional)
    };
    phone: {
      primary: string;        // "+919876543210"
      alternate: string;      // "" (optional)
    };
    linkedin: string;         // "https://linkedin.com/in/chahal" (optional)
    github: string;           // "https://github.com/chahal" (optional)
  };

  personal: {
    gender: "Male" | "Female" | "Other" | "";
    dob: string;              // "2002-11-15" (ISO format YYYY-MM-DD) (optional)
  };

  academic: {
    college: string;          // "Chandigarh Group of Colleges"
    degree: string;           // "B.Tech"
    department: string;       // "Computer Science and Engineering"
    enrollment: string;       // "24BCS13345" (user-provided exactly)
    gradYear: string;         // "2028"
    cgpa: string;             // "8.5" (optional)
    graduationPercentage: string; // "" (optional; some forms ask % not CGPA)

    tenth: {
      board: string;          // "CBSE"
      percentage: string;     // "92.5"
      passingYear: string;    // "2020"
    };

    twelfth: {
      board: string;          // "CBSE"
      percentage: string;     // "90.0"
      passingYear: string;    // "2022"
    };

    pg: {
      percentage: string;     // "" (optional; only for PG students)
      degree: string;         // "" (optional)
    };
  };

  placement: {
    activeBacklog: "Yes" | "No" | "";
    backlogCount: string;     // "0" (optional; relevant only if activeBacklog = "Yes")
  };
}
```

**Design notes:**
- `name.full` is computed at fill time by joining `[first, middle, last].filter(Boolean).join(" ")`. It is never stored separately. This avoids the profile going out of sync if the user edits first/last name.
- `academic.enrollment` takes the full roll number as the user typed it (e.g., `"24BCS13345"`). The extension does not parse or validate the format — the user is responsible for entering it correctly.
- `personal.dob` is stored in ISO format (`YYYY-MM-DD`). The fill logic may need to reformat it depending on what the form expects (see Section 7.3).
- `contact.phone.primary` should include the country code (e.g., `+91`). The fill logic strips it when filling fields that only accept 10 digits.

---

### 5.2 Static Mappings

Static mappings are hardcoded in `src/core/matcher/staticMappings.ts`. Each entry maps a set of label patterns (keywords and phrases) to a profile key path. See Appendix A for the full mapping table.

The structure:

```typescript
interface StaticMapping {
  key: ProfileKeyPath;        // e.g., "name.full"
  patterns: string[];         // e.g., ["full name", "student name", "candidate name"]
  constraint?: "not-college-email" | "college-email" | "personal-email";
}
```

---

### 5.3 Learned Mappings

Stored under `forma_learned_mappings` as an array of objects:

```typescript
interface LearnedMapping {
  normalizedLabel: string;    // lowercase, trimmed, asterisk-removed label text
  profileKey: ProfileKeyPath; // resolved profile key
  savedAt: number;            // Unix timestamp (ms)
}
```

Example:

```json
[
  {
    "normalizedLabel": "enrollment id",
    "profileKey": "academic.enrollment",
    "savedAt": 1714000000000
  },
  {
    "normalizedLabel": "applicant's full name",
    "profileKey": "name.full",
    "savedAt": 1714001000000
  }
]
```

---

### 5.4 Settings

Stored under `forma_settings`:

```typescript
interface FormaSettings {
  autoFillOnLoad: boolean;     // default: false
  autoFillDelay: number;       // ms, default: 500
  fuseThreshold: number;       // default: 0.35
  highlightFilled: string;     // hex color, default: "#d4edda"
  highlightSkipped: string;    // hex color, default: "#fff3cd"
}
```

---

### 5.5 Storage Key Summary

| Storage Key | Contents |
|---|---|
| `forma_profile` | Full user profile (FormaProfile) |
| `forma_learned_mappings` | Array of LearnedMapping objects |
| `forma_settings` | FormaSettings object |

All three keys reside in `chrome.storage.local`.

---

## 6. System Architecture

### 6.1 Manifest V3 Overview

Manifest V3 (MV3) replaces background pages with service workers. Service workers are event-driven and may be terminated between events — they cannot hold state across unrelated events. All persistent state must live in `chrome.storage`.

The three main runtime contexts in MV3 are:
- **Popup** — the HTML page shown when the icon is clicked. Has its own JS runtime. Communicates with the service worker via `chrome.runtime.sendMessage`.
- **Service Worker** — the background script. Receives messages, routes them, and executes scripts in tabs.
- **Content Script** — injected into the Google Form page. Has DOM access. Communicates via `chrome.runtime.sendMessage`.

### 6.2 Component Communication Flow

```
User clicks "Autofill"
         │
         ▼
  [Popup UI]
  popup.ts
  chrome.runtime.sendMessage("FORMA_FILL")
         │
         ▼
  [Service Worker]
  service-worker.ts
  chrome.scripting.executeScript → content script entry point
         │
         ▼
  [Content Script]
  content/index.ts
  ├── reads chrome.storage.local (profile + learned mappings + settings)
  ├── calls domParser → extracts labels + input refs
  ├── calls matcher → gets profileKey per label
  ├── calls filler → fills each input
  ├── calls highlighter → applies CSS classes
  └── sends "FORMA_RESULT" back to service worker
         │
         ▼
  [Service Worker]
  relays FORMA_RESULT to popup
         │
         ▼
  [Popup UI]
  displays summary
```

### 6.3 Module Responsibilities

**`src/background/service-worker.ts`**
Receives `FORMA_FILL` from popup. Calls `chrome.scripting.executeScript` to run the content script orchestrator in the active tab. Receives `FORMA_RESULT` and `FORMA_LEARN_CANDIDATE` messages. For learn candidates, triggers the notification prompt and handles `"FORMA_LEARN_CONFIRM"` to persist the mapping.

**`src/content/index.ts`**
The orchestrator injected into the form page. Reads storage, runs the pipeline (parse → match → fill → highlight → report), attaches learning listeners, and sends results back.

**`src/content/domParser.ts`**
Responsible for querying the Google Forms DOM. Returns an array of `FormField` objects, each containing the raw label, normalized label, the input element reference(s), and the detected input type.

**`src/content/highlighter.ts`**
Injects a `<style>` tag with the highlight CSS classes. Applies and removes classes on question containers. Exposes `applyHighlight(container, type)` and `clearAllHighlights()`.

**`src/content/learningWatcher.ts`**
Attaches `blur`/`change` listeners to all inputs after filling. On change, attempts a reverse value lookup in the profile. If found, sends `FORMA_LEARN_CANDIDATE` to the service worker.

**`src/core/matcher/index.ts`**
The matching engine orchestrator. Runs Layer 1 → Layer 2 → Layer 3 in sequence. Returns a `MatchResult` or `null`.

**`src/core/matcher/keywordMatcher.ts`**
Layer 1 matching. Runs through the static mappings and learned mappings, checking if the normalized label contains or equals any registered pattern.

**`src/core/matcher/fuzzyMatcher.ts`**
Layer 2 matching. Builds a Fuse.js index from the static mapping patterns. Searches the normalized label against this index and returns the best match if it beats the threshold.

**`src/core/matcher/structuralMatcher.ts`**
Layer 3 matching. Handles special structural cases: name splitting, constraint detection ("not college domain"), and backlog count correlation.

**`src/core/parser/nameParser.ts`**
Parses the `name.full` computed value into first/middle/last parts for filling split name fields.

**`src/core/parser/constraintParser.ts`**
Scans label text for embedded constraints (e.g., "not college domain", "personal email only", "with country code") and returns constraint flags used by the filler.

**`src/core/filler/index.ts`**
Routes to the correct filler based on detected input type.

**`src/core/filler/textFiller.ts`**
Fills `<input type="text">`, `<input type="email">`, `<input type="number">`, and `<textarea>` elements.

**`src/core/filler/radioFiller.ts`**
Finds and clicks the matching radio option. Uses Fuse.js to match the profile value against option texts.

**`src/core/filler/dropdownFiller.ts`**
Opens the listbox, finds the matching option, and clicks it.

**`src/core/storage/storageManager.ts`**
A promise-based wrapper around `chrome.storage.local`. Handles typed get/set operations. Used by the content script and service worker.

**`src/popup/popup.ts`**
Manages the popup UI: reads settings, sends messages, displays results.

**`src/options/options.ts`**
Manages the profile form: loads existing data, validates, saves.

**`src/types/index.ts`**
All shared TypeScript interfaces and types: `FormaProfile`, `FormaSettings`, `LearnedMapping`, `FormField`, `MatchResult`, `FillResult`, `ProfileKeyPath`, message type literals.

**`src/utils/constants.ts`**
The static mappings array, default settings, class name constants, and selector strings for Google Forms DOM queries.

---

## 7. Matching Engine Design

The matching engine is the intellectual core of Forma. It takes a normalized label string and returns the best matching profile key path. Three layers run in sequence; the first confident match wins.

### 7.1 Matching Data Structures

```typescript
interface MatchResult {
  profileKey: ProfileKeyPath;   // e.g., "name.full"
  score: number;                // 0 = perfect, 1 = no match (Fuse.js convention)
  source: "learned" | "keyword" | "fuzzy" | "structural";
  constraint?: ConstraintFlag;
}

type ConstraintFlag =
  | "use-personal-email"
  | "use-college-email"
  | "phone-without-country-code"
  | "split-first-name"
  | "split-last-name"
  | "split-middle-name";
```

---

### 7.2 Layer 0: Learned Mappings Check (Pre-Engine)

Before the three layers run, the matcher checks `forma_learned_mappings` for an exact match on the normalized label. This is a simple array `.find()` operation.

If found, it returns a `MatchResult` with `score: 0` and `source: "learned"`. The engine stops. This gives learned mappings the highest priority.

---

### 7.3 Layer 1: Keyword Matching

Layer 1 iterates through the static mappings in `constants.ts`. For each mapping entry, it checks whether the normalized label **contains** any of the listed patterns as a substring or equals them exactly.

This is case-insensitive and uses `String.prototype.includes()`. No fuzzy logic is applied here — it is purely substring-based.

The advantage of substring containment over exact match is that it handles common additions like "your full name" matching pattern "full name", or "primary mobile number" matching "primary mobile".

**Important:** Layer 1 also runs the constraint parser (Section 7.6) on the label before matching. If the label contains "not college domain" or "personal", and the candidate key is `email.personal`, this is a constraint-confirmed match with score 0. If the label contains "college email", the key becomes `email.college`.

If Layer 1 finds a match, it returns immediately with `score: 0` and `source: "keyword"`.

---

### 7.4 Layer 2: Fuzzy Matching (Fuse.js)

If Layer 1 finds no match, Layer 2 runs Fuse.js against the full normalized label.

**Why Fuse.js and not something heavier?**
Forms are semi-structured text, not natural language sentences. The question labels are short phrases (3–6 words) that are variations of a known set of concepts. Fuse.js handles this perfectly — it computes a similarity score between the input string and a list of candidate strings, handling typos, partial matches, and word-order variations. No ML model or API is needed for this use case.

**Fuse.js configuration:**

```typescript
const fuseOptions: Fuse.IFuseOptions<StaticMapping> = {
  keys: ["patterns"],          // search against pattern strings
  threshold: 0.35,             // configurable via settings
  ignoreLocation: true,        // match anywhere in the string, not just at start
  includeScore: true,          // needed to evaluate confidence
  useExtendedSearch: false,
};

const fuse = new Fuse(flattenedPatterns, fuseOptions);
// flattenedPatterns = one entry per pattern string, each carrying its parent profileKey
```

**How threshold works:**
A Fuse score of 0.0 is a perfect match. A score of 1.0 means the strings are completely different. Setting the threshold to 0.35 means Fuse will only report matches where the strings are at least 65% similar. This is deliberately conservative to prevent wrong fills.

For example:
- "student full name" vs. pattern "full name" → score ~0.1 (match accepted)
- "applicant mobile" vs. pattern "phone" → score ~0.25 (match accepted)
- "why do you want this job" vs. any pattern → score > 0.35 (no match, skipped)

If Layer 2 finds a result below threshold, it returns with `source: "fuzzy"`. If not, Layer 3 runs.

---

### 7.5 Layer 3: Structural Matching

Layer 3 handles cases that cannot be resolved by keyword or fuzzy matching because they require understanding the semantic relationship between multiple fields or require format-aware logic.

**Case 1: Split Name Fields**
If the label contains "first name", "given name" → key is `name.first`, constraint `split-first-name`.
If the label contains "last name", "surname", "family name" → key is `name.last`, constraint `split-last-name`.
If the label contains "middle name" → key is `name.middle`, constraint `split-middle-name`.

The filler uses the `nameParser` to compute the right part of the full name at fill time.

**Case 2: Phone Number Format**
If the label or its surrounding text contains hints like "10 digit", "without country code", or "do not include +91", the constraint `phone-without-country-code` is set. The filler then strips the country code before filling.

**Case 3: Backlog Count Dependency**
If the label matches "number of active backlog" or similar, and `placement.activeBacklog` is `"No"`, the filler uses `"0"` as the value regardless of what `placement.backlogCount` says.

**Case 4: Date of Birth Formatting**
DOB is stored as `YYYY-MM-DD`. If the field is a text input, the filler checks the label for format hints ("DD/MM/YYYY", "MM-DD-YYYY") and reformats accordingly. If no hint is found, the stored ISO format is used.

If Layer 3 cannot resolve the field, it returns `null`. The field is marked skipped.

---

### 7.6 Constraint Parser

The constraint parser (`constraintParser.ts`) scans the raw (non-normalized) label text for embedded instructions. It returns a `ConstraintFlag` or `null`.

Common embedded constraint phrases to detect:

| Pattern in label | Resulting constraint |
|---|---|
| "not college", "not college domain", "personal email" | `use-personal-email` |
| "college email", "official email", "university email" | `use-college-email` |
| "without +91", "10 digit", "without country code" | `phone-without-country-code` |

---

## 8. Field Filling Logic

### 8.1 Intent-First Principle

The filler does NOT branch first on field type. It branches first on the semantic intent (the matched profile key), then adapts to the field type. This is the "intent-first" principle.

```typescript
// WRONG approach (field-type-first):
if (fieldType === "radio") { ... }
else if (fieldType === "dropdown") { ... }

// CORRECT approach (intent-first):
const value = resolveProfileValue(matchResult);  // "Chandigarh Group of Colleges"
await filler.fill(container, fieldType, value);   // filler handles the mechanics
```

This ensures that "college" resolves to the same value regardless of whether the form uses a radio button or a dropdown.

---

### 8.2 Text Input Filling

Filling a text input (`<input>` or `<textarea>`):

1. Set `element.value = resolvedValue`
2. Dispatch `new Event('input', { bubbles: true })` to notify Google's React listeners
3. Dispatch `new Event('change', { bubbles: true })` as a fallback

The `input` event is the critical one — Google Forms uses React under the hood, and React listens for synthetic input events to update its internal state. Without dispatching this event, the form will not register the filled value on submission.

If any step throws, the operation is marked as failed. The value is cleared (`element.value = ""`), and the field is counted as skipped.

---

### 8.3 Radio Button Filling

1. Query all `div[role="radio"]` elements within the question container
2. Extract the visible text from each option (likely inside a `<span>` within the radio div)
3. Use Fuse.js to find the option whose text best matches the resolved profile value
4. If a match is found (score below threshold), call `.click()` on that option element
5. If no match is found (e.g., "Chandigarh Group of Colleges" vs options ["GNDU", "PU"]), the field is skipped

For `placement.gender`, the profile stores `"Male"`, `"Female"`, or `"Other"`. These will match radio options like "Male"/"Female" trivially (score ~0).

For `placement.activeBacklog`, the profile stores `"Yes"` or `"No"`. These match options exactly.

---

### 8.4 Dropdown Filling

Google Forms renders dropdowns as a `div[role="listbox"]` element. The options inside are not visible in the DOM until the listbox is opened.

Steps:
1. Click the `div[role="listbox"]` element to open it
2. Wait 150ms for the dropdown to render (using a `setTimeout` wrapped in a `Promise`)
3. Query all `div[role="option"]` or `div.quantumWizMenuPaperselectOption` elements
4. Use Fuse.js to match the resolved profile value against the text of each option
5. Click the matching option
6. If no match found, close the dropdown (click outside or press Escape) and mark as skipped

The 150ms delay in step 2 may need adjustment based on testing. It is configurable if needed.

---

### 8.5 Value Resolution

Before the filler runs, the `resolveProfileValue(matchResult, profile)` function computes the actual string value to fill:

```typescript
function resolveProfileValue(match: MatchResult, profile: FormaProfile): string {
  switch (match.profileKey) {
    case "name.full":
      return [profile.name.first, profile.name.middle, profile.name.last]
        .filter(Boolean).join(" ");

    case "name.first":
      return profile.name.first;

    case "name.last":
      return profile.name.last;

    case "contact.phone.primary":
      if (match.constraint === "phone-without-country-code") {
        // Strip country code: remove leading + and next 1-3 digits
        return profile.contact.phone.primary.replace(/^\+\d{1,3}/, "");
      }
      return profile.contact.phone.primary;

    case "contact.email.personal":
      return profile.contact.email.personal;

    case "contact.email.college":
      return profile.contact.email.college;

    case "placement.backlogCount":
      if (profile.placement.activeBacklog === "No") return "0";
      return profile.placement.backlogCount;

    // ... all other keys follow the same pattern: profile[group][field]
    default:
      return getNestedValue(profile, match.profileKey) ?? "";
  }
}
```

---

## 9. DOM Interaction Patterns

### 9.1 Google Forms DOM Structure (as of 2025–2026)

Google Forms renders each question inside a structure like this (simplified):

```html
<div class="freebirdFormviewerComponentsQuestionBaseRoot">
  <div role="heading" class="freebirdFormviewerComponentsQuestionBaseTitle">
    Student Full Name *
  </div>

  <!-- Text input variant -->
  <div class="freebirdFormviewerComponentsQuestionTextRoot">
    <div class="quantumWizTextinputPaperinputMainContent">
      <input type="text" class="quantumWizTextinputPaperinputInput" jsname="YPqjbf" />
    </div>
  </div>

  <!-- OR Radio variant -->
  <div class="freebirdFormviewerComponentsQuestionRadioRoot">
    <div role="radio" class="freebirdFormviewerComponentsQuestionRadioOptionContainer">
      <span>Male</span>
    </div>
    <div role="radio" ...><span>Female</span></div>
  </div>

  <!-- OR Dropdown variant -->
  <div role="listbox" class="quantumWizMenuPaperselectEl">
    <!-- options only appear after click -->
  </div>
</div>
```

**Warning:** Google may update class names in their Forms application. If the extension stops working after a Google update, the first place to check is the selector strings in `src/utils/constants.ts`. The use of `role` attributes (which Google is less likely to change) as fallback selectors adds resilience.

---

### 9.2 Selector Strategy

Primary selectors use semantic `role` attributes. Class-based selectors are fallbacks.

```typescript
// In constants.ts
export const SELECTORS = {
  QUESTION_CONTAINER: [
    '.freebirdFormviewerComponentsQuestionBaseRoot',
    'div[data-item-id]',    // fallback role-based
  ],
  QUESTION_LABEL: [
    'div[role="heading"]',
    '.freebirdFormviewerComponentsQuestionBaseTitle',
  ],
  TEXT_INPUT: 'input[type="text"], input[type="email"], input[type="number"], textarea',
  RADIO_OPTION: 'div[role="radio"]',
  DROPDOWN_CONTAINER: 'div[role="listbox"]',
  DROPDOWN_OPTION: 'div[role="option"], .quantumWizMenuPaperselectOption',
};
```

The `domParser.ts` tries each selector in priority order and takes the first result.

---

### 9.3 DOM Parsing Logic

```typescript
export function parseFormFields(): FormField[] {
  const containers = queryAll(SELECTORS.QUESTION_CONTAINER);
  const fields: FormField[] = [];

  for (const container of containers) {
    const labelEl = queryFirst(SELECTORS.QUESTION_LABEL, container);
    if (!labelEl) continue;

    const rawLabel = labelEl.innerText ?? "";
    const normalizedLabel = normalizeLabel(rawLabel);
    if (!normalizedLabel) continue;

    const inputType = detectInputType(container);
    if (inputType === null) continue; // section header, skip

    fields.push({ container, rawLabel, normalizedLabel, inputType });
  }

  return fields;
}

function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\*/g, "")     // remove required asterisk
    .replace(/\s+/g, " ")   // collapse whitespace
    .trim();
}

function detectInputType(container: Element): FieldType | null {
  if (queryFirst(SELECTORS.TEXT_INPUT, container)) return "text";
  if (queryFirst(SELECTORS.RADIO_OPTION, container)) return "radio";
  if (queryFirst(SELECTORS.DROPDOWN_CONTAINER, container)) return "dropdown";
  return null;
}
```

---

## 10. UI/UX Specification

### 10.1 Extension Popup

The popup opens when the user clicks the Forma icon. Approximate layout:

```
┌──────────────────────────────────┐
│  Forma                           │
│  Smart placement form filler     │
├──────────────────────────────────┤
│  Profile: ✅ Complete             │
│                                  │
│  [  Autofill This Form  ]        │  ← Primary CTA, disabled if no profile
│                                  │
│  ─────────────────────────────── │
│  Results:                        │
│  8 fields filled, 2 skipped.     │
│                                  │
│  [  Clear Highlights  ]          │
│  ─────────────────────────────── │
│  ⚡ Autofill on page load   [ ○ ] │  ← Toggle, default OFF
│                                  │
│  ⚙ Edit Profile                  │  ← Opens options page
└──────────────────────────────────┘
```

States of the popup:

- **No profile saved:** "Profile: ⚠ Incomplete. Click Edit Profile to set up." Autofill button is disabled.
- **Profile saved, on a Google Form:** Full UI as above.
- **Profile saved, not on a Google Form:** Autofill button is disabled. Small note: "Open a Google Form to use Forma."
- **After autofill:** Results area shows `"X filled, Y skipped."` and Clear Highlights becomes active.

---

### 10.2 Options Page (Profile Editor)

The options page is a full browser tab opened via `chrome.runtime.openOptionsPage()`. It contains a form organized into logical sections:

**Section 1 — Name**
- First Name `*`
- Middle Name
- Last Name `*`

**Section 2 — Contact**
- Personal Email `*`
- College Email
- Alternate Email
- Primary Phone (with country code) `*`
- Alternate Phone
- LinkedIn URL
- GitHub URL

**Section 3 — Personal**
- Gender (dropdown: Male / Female / Other)
- Date of Birth (date input, formatted as YYYY-MM-DD)

**Section 4 — Academic**
- College Name `*`
- Degree `*`
- Department / Branch `*`
- Enrollment / Roll Number `*`
- Expected Graduation Year `*`
- CGPA (optional)
- Graduation Percentage (optional)

**Section 5 — 10th Standard**
- Board `*` (e.g., CBSE, PSEB)
- Percentage `*`
- Year of Passing `*`

**Section 6 — 12th Standard**
- Board `*`
- Percentage `*`
- Year of Passing `*`

**Section 7 — Post Graduation (optional)**
- Degree
- Percentage

**Section 8 — Placement Info**
- Active Backlog (radio: Yes / No)
- Number of Active Backlogs (number input, visible only if Active Backlog = Yes)

Buttons at the bottom:
- **Save Profile** (validates required fields, shows inline errors)
- **Clear All Data** (with confirmation dialog: "This will delete all your saved data. Are you sure?")

On save success: show a toast message: "Profile saved successfully."

---

### 10.3 In-Page Highlights

Two CSS classes are injected into the Google Form page:

```css
.forma-filled {
  background-color: #d4edda !important;
  border-left: 3px solid #28a745 !important;
  transition: background-color 0.2s ease;
}

.forma-skipped {
  background-color: #fff3cd !important;
  border-left: 3px solid #ffc107 !important;
  transition: background-color 0.2s ease;
}
```

These are applied to the question container (`freebirdFormviewerComponentsQuestionBaseRoot`), not the input itself, so the entire question block is visually distinguished.

The `clearAllHighlights()` function in `highlighter.ts` removes both classes from all elements.

---

### 10.4 Learning Prompt

When a user edits a filled or skipped field and a reverse-lookup succeeds, a Chrome notification is shown:

- **Title:** "Forma — Save Mapping?"
- **Body:** `"Save 'enrollment id' → Roll Number for future forms?"`
- **Buttons:** "Yes, Save" and "Dismiss"

If the user clicks "Yes, Save," the service worker persists the learned mapping.

If `chrome.notifications` is unavailable or the popup is open, the prompt can be shown as a subtle UI element within the popup instead.

---

## 11. Learning Workflow

```
User manually edits a field on the form
              │
              ▼
  learningWatcher detects blur event
              │
              ▼
  Is the new value a known profile value? (reverse lookup)
              │
      ┌───────┴───────┐
     YES              NO
      │               │
      ▼               ▼
  Send FORMA_LEARN   Do nothing
  _CANDIDATE to
  service worker
      │
      ▼
  service-worker shows Chrome notification
  "Save mapping for '[label]'?"
      │
    ┌─┴─┐
   YES   NO
    │     │
    ▼     ▼
  Save  Dismiss
  to    notification
  forma_learned_mappings
```

**Reverse lookup logic:** Given a value the user typed (e.g., `"24BCS13345"`), the learning watcher iterates through all leaf values in the profile and checks for an exact match. If `profile.academic.enrollment === "24BCS13345"`, the resolved key is `"academic.enrollment"`. The mapping saved is `{ normalizedLabel: "enrollment number", profileKey: "academic.enrollment" }`.

---

## 12. Error Handling

### 12.1 General Principle

The content script must never crash the Google Form page. Every DOM operation is wrapped in try/catch. On any exception, the field is marked as skipped, the value is cleared if it was partially set, and execution continues to the next field.

### 12.2 Specific Cases

| Scenario | Behavior |
|---|---|
| Label element not found in container | Skip container silently |
| Profile not loaded from storage | Abort fill, popup shows "Profile not found. Please set up your profile." |
| Matched profile key resolves to empty string | Skip field (treat as no match) |
| Input element not found for fill | Mark as skipped |
| `element.value` assignment fails | Catch error, clear value, mark as skipped |
| Event dispatch throws | Catch, mark as skipped, clear value |
| Dropdown fails to open | Catch, mark as skipped |
| Dropdown option not found | Close dropdown, mark as skipped |
| Service worker not responsive | Popup shows a generic error and times out after 5 seconds |

### 12.3 Console Logging

All significant operations must log to console at the `debug` level. The format must include the label and the action taken:

```typescript
console.debug(`[Forma] "${rawLabel}" → matched "${profileKey}" (score: ${score}, source: ${source})`);
console.debug(`[Forma] "${rawLabel}" → filled as ${fieldType}`);
console.warn(`[Forma] "${rawLabel}" → fill failed: ${error.message}. Marked as skipped.`);
```

These logs are visible in Chrome DevTools under the content script's context for debugging.

---

## 13. Testing Strategy

### 13.1 Unit Tests (Matcher Module)

The matching engine is the most critical and most easily unit-testable component. Write tests in `src/__tests__/matcher.test.ts` using a standard test runner (Jest or Vitest).

Test cases must cover:
- Exact label matches (e.g., `"name"` → `name.full`)
- Label variations (e.g., `"student full name"`, `"candidate name"`, `"your name"` all → `name.full`)
- Split name labels (`"first name"` → `name.first`, `"last name"` → `name.last`)
- Constraint detection (`"personal email id (not college domain)"` → `email.personal` with `use-personal-email` constraint)
- Fuzzy matches (e.g., `"prmary mobile"` with typo → `contact.phone.primary`)
- Rejection of unrelated labels (e.g., `"why do you want to join"` → no match)
- Learned mapping priority (learned mapping overrides static for the same label)
- Backlog count constraint (backlogCount resolves to "0" when activeBacklog is "No")

### 13.2 Integration Tests (DOM)

Create a mock HTML file at `test/mock-form.html` that simulates a Google Form's DOM structure. Include:
- A text input question
- A radio question (college selection: CGC / CU)
- A dropdown question (gender or backlog)
- A question with a constraint in the label

Run the content script logic against this mock DOM using jsdom (Jest's default environment) and assert that:
- The correct elements are found
- The correct values are filled
- The highlights are applied correctly

### 13.3 End-to-End Testing

Manually test on real Google Forms with a test profile. Test checklist:
- Fill a form with 10+ fields and verify all expected fills
- Verify radio button selection (gender, active backlog)
- Verify dropdown selection (college name)
- Verify that unrecognized fields are left blank and highlighted yellow
- Verify green/yellow highlights appear correctly
- Click "Clear Highlights" and verify all highlights are removed
- Enable "Autofill on page load" and reload the form — verify auto-fill triggers
- Edit a filled field and verify the learning prompt appears
- Confirm a learned mapping and reload the form — verify the learned label is now filled

### 13.4 Regression Testing

After any change to the static mappings table or matching logic, re-run all unit tests before committing. The matcher is the most sensitive component and changes there can have wide-ranging effects.

---

## 14. Project Structure

```
forma-extension/
│
├── manifest.json                  # Extension manifest (MV3)
├── package.json                   # Dependencies and build scripts
├── tsconfig.json                  # TypeScript configuration
├── build.mjs                      # esbuild build script
│
├── src/
│   ├── types/
│   │   └── index.ts               # All shared interfaces
│   │
│   ├── utils/
│   │   ├── constants.ts           # Static mappings, selectors, defaults
│   │   └── helpers.ts             # Shared utility functions
│   │
│   ├── core/
│   │   ├── matcher/
│   │   │   ├── index.ts           # Matcher orchestrator
│   │   │   ├── keywordMatcher.ts  # Layer 1
│   │   │   ├── fuzzyMatcher.ts    # Layer 2 (Fuse.js)
│   │   │   └── structuralMatcher.ts # Layer 3
│   │   │
│   │   ├── parser/
│   │   │   ├── nameParser.ts      # Splits full name into parts
│   │   │   └── constraintParser.ts # Detects constraints in labels
│   │   │
│   │   ├── filler/
│   │   │   ├── index.ts           # Filler router
│   │   │   ├── textFiller.ts      # Fills text/email/number inputs
│   │   │   ├── radioFiller.ts     # Clicks radio options
│   │   │   └── dropdownFiller.ts  # Opens + selects dropdown
│   │   │
│   │   └── storage/
│   │       └── storageManager.ts  # chrome.storage.local wrapper
│   │
│   ├── content/
│   │   ├── index.ts               # Main content script entry (orchestrator)
│   │   ├── domParser.ts           # Google Forms DOM querying
│   │   ├── highlighter.ts         # CSS highlight injection
│   │   └── learningWatcher.ts     # Edit detection + learn candidate dispatch
│   │
│   ├── background/
│   │   └── service-worker.ts      # MV3 service worker
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   │
│   └── options/
│       ├── options.html
│       ├── options.ts
│       └── options.css
│
├── dist/                          # Build output (gitignored)
│
├── assets/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
└── test/
    ├── mock-form.html             # Mock Google Form DOM
    └── __tests__/
        ├── matcher.test.ts
        ├── nameParser.test.ts
        └── constraintParser.test.ts
```

---

### 14.1 manifest.json Template

```json
{
  "manifest_version": 3,
  "name": "Forma",
  "version": "1.0.0",
  "description": "Smart autofill for placement and internship Google Forms.",
  "icons": {
    "16": "assets/icon16.png",
    "48": "assets/icon48.png",
    "128": "assets/icon128.png"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Forma"
  },
  "options_page": "options/options.html",
  "background": {
    "service_worker": "dist/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://docs.google.com/forms/*"],
      "js": ["dist/content.js"],
      "run_at": "document_idle"
    }
  ],
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "notifications"
  ],
  "host_permissions": [
    "https://docs.google.com/forms/*"
  ]
}
```

---

### 14.2 Build Setup (esbuild)

esbuild is a fast, zero-configuration bundler that handles TypeScript natively. It produces a single output file per entry point, which is exactly what Chrome extensions need.

```javascript
// build.mjs
import { build } from 'esbuild';

const shared = {
  bundle: true,
  target: 'chrome120',
  platform: 'browser',
};

await Promise.all([
  build({ ...shared, entryPoints: ['src/background/service-worker.ts'], outfile: 'dist/service-worker.js' }),
  build({ ...shared, entryPoints: ['src/content/index.ts'], outfile: 'dist/content.js' }),
  build({ ...shared, entryPoints: ['src/popup/popup.ts'], outfile: 'dist/popup.js' }),
  build({ ...shared, entryPoints: ['src/options/options.ts'], outfile: 'dist/options.js' }),
]);
```

```json
// package.json (relevant section)
{
  "scripts": {
    "build": "node build.mjs",
    "watch": "node build.mjs --watch",
    "test": "vitest"
  },
  "dependencies": {
    "fuse.js": "^7.0.0"
  },
  "devDependencies": {
    "esbuild": "^0.20.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

Loading the extension in Chrome: Go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select the `forma-extension/` folder (the root, not `dist/`). After any code change, run `npm run build` and click the refresh icon on the extension card.

---

## 15. Deployment

For v1, this is a personal-use extension loaded in developer mode. No Chrome Web Store submission is required.

If publishing to the Web Store in the future, the following will be needed:
- A one-time developer registration fee ($5)
- A privacy policy (simple: "all data stays on your device")
- Extension screenshots (popup + options page)
- A description emphasizing the placement/student use case

---

## 16. Future Scope (Post-v1)

These features are explicitly deferred and must not influence v1 implementation decisions:

- **Learned Mappings Manager** — a UI in the options page to view, edit, and delete learned mappings
- **Preview Before Fill** — show a side-by-side preview of what will be filled before executing
- **Multi-Profile Support** — maintain multiple profiles (e.g., one for placement, one for internships)
- **Edge/Brave Support** — evaluate whether the Manifest V3 implementation works on Chromium-based browsers without changes
- **Non-Google-Forms Support** — abstract the DOM parser to support other form-heavy websites
- **Backend Sync** — cloud profile storage for multi-device access (would require authentication)
- **Analytics Dashboard** — track which forms were filled, how many fields matched, etc.

---

## Appendix A: Full Static Mapping Table

This table defines all entries in `src/utils/constants.ts`. Patterns are matched as case-insensitive substrings.

| Profile Key | Patterns |
|---|---|
| `name.full` | "name", "full name", "student name", "candidate name", "applicant name", "your name", "participant name", "student full name", "name of student", "name of candidate", "name of applicant" |
| `name.first` | "first name", "given name", "first" |
| `name.middle` | "middle name", "middle" |
| `name.last` | "last name", "surname", "family name", "last" |
| `contact.email.personal` | "email", "email id", "email address", "personal email", "personal mail", "personal email id", "gmail", "non-college email", "email (not college)" |
| `contact.email.college` | "college email", "official email", "university email", "institute email", "college mail", "college email id", "institutional email" |
| `contact.phone.primary` | "phone", "mobile", "contact number", "primary mobile", "phone number", "mobile number", "primary phone", "contact", "phone no", "mobile no", "whatsapp" |
| `contact.phone.alternate` | "alternate phone", "alternate mobile", "secondary phone", "other number", "alternate number" |
| `contact.linkedin` | "linkedin", "linkedin url", "linkedin profile", "linkedin id" |
| `contact.github` | "github", "github url", "github profile", "github id" |
| `personal.gender` | "gender", "sex" |
| `personal.dob` | "date of birth", "dob", "birth date", "date of birth (dd/mm/yyyy)", "d.o.b" |
| `academic.college` | "college", "college name", "university", "university name", "institute", "institution", "school name", "institution name" |
| `academic.degree` | "degree", "course", "program", "qualification", "degree program", "current course" |
| `academic.department` | "branch", "stream", "department", "specialization", "field of study", "engineering branch", "your branch", "dept" |
| `academic.enrollment` | "roll number", "roll no", "enrollment", "enrollment number", "registration number", "student id", "id number", "university roll", "university roll number", "enrollment id", "reg no", "reg number" |
| `academic.gradYear` | "passing year", "graduation year", "year of passing", "year of graduation", "batch", "expected year", "pass out year" |
| `academic.cgpa` | "cgpa", "gpa", "cumulative gpa", "current cgpa", "sgpa" |
| `academic.graduationPercentage` | "graduation percentage", "ug percentage", "b.tech percentage", "aggregate percentage", "current percentage", "overall percentage", "percentage" |
| `academic.tenth.percentage` | "10th percentage", "10th marks", "ssc percentage", "matriculation percentage", "class x percentage", "10th %", "10th grade percentage", "x percentage", "class 10 percentage" |
| `academic.tenth.board` | "10th board", "ssc board", "class x board", "matriculation board", "10th passing board" |
| `academic.tenth.passingYear` | "10th passing year", "ssc year", "year of passing 10th", "class x year", "10th year" |
| `academic.twelfth.percentage` | "12th percentage", "12th marks", "hsc percentage", "intermediate percentage", "class xii percentage", "12th %", "class 12 percentage", "xii percentage" |
| `academic.twelfth.board` | "12th board", "hsc board", "class xii board", "intermediate board", "12th passing board" |
| `academic.twelfth.passingYear` | "12th passing year", "hsc year", "year of passing 12th", "class xii year", "12th year" |
| `academic.pg.percentage` | "pg percentage", "post graduation percentage", "masters percentage", "m.tech percentage", "post-graduate percentage" |
| `placement.activeBacklog` | "active backlog", "any active backlog", "current backlog", "backlog", "pending backlog", "do you have a backlog", "backlog status" |
| `placement.backlogCount` | "number of backlogs", "no of active backlog", "backlog count", "number of active backlogs", "how many backlogs", "total backlogs" |

---

## Appendix B: Sample Profile JSON

A complete example of what `forma_profile` looks like in storage for a CGC student:

```json
{
  "name": {
    "first": "Chahal",
    "middle": "",
    "last": "Goyal"
  },
  "contact": {
    "email": {
      "personal": "chahalgoyal@gmail.com",
      "college": "24bcs13345@cgc.edu.in",
      "alternate": ""
    },
    "phone": {
      "primary": "+919876543210",
      "alternate": ""
    },
    "linkedin": "https://linkedin.com/in/chahalgoyal",
    "github": "https://github.com/chahalgoyal"
  },
  "personal": {
    "gender": "Male",
    "dob": "2003-05-14"
  },
  "academic": {
    "college": "Chandigarh Group of Colleges",
    "degree": "B.Tech",
    "department": "Computer Science and Engineering",
    "enrollment": "24BCS13345",
    "gradYear": "2028",
    "cgpa": "8.4",
    "graduationPercentage": "",
    "tenth": {
      "board": "CBSE",
      "percentage": "92.5",
      "passingYear": "2020"
    },
    "twelfth": {
      "board": "CBSE",
      "percentage": "89.0",
      "passingYear": "2022"
    },
    "pg": {
      "percentage": "",
      "degree": ""
    }
  },
  "placement": {
    "activeBacklog": "No",
    "backlogCount": "0"
  }
}
```

---

## Appendix C: Message Protocol Reference

All communication between the popup, service worker, and content script uses `chrome.runtime.sendMessage`. Messages follow this shape:

```typescript
interface FormaMessage {
  type: MessageType;
  payload?: unknown;
}

type MessageType =
  | "FORMA_FILL"              // popup → service worker → content script
  | "FORMA_RESULT"            // content script → service worker → popup
  | "FORMA_CLEAR_HIGHLIGHTS"  // popup → service worker → content script
  | "FORMA_LEARN_CANDIDATE"   // content script → service worker
  | "FORMA_LEARN_CONFIRM"     // notification button → service worker
  | "FORMA_LEARN_DISMISS";    // notification button → service worker
```

**FORMA_RESULT payload:**
```typescript
{
  filledCount: number;
  skippedCount: number;
  filledLabels: string[];    // for debugging
  skippedLabels: string[];   // for user info
}
```

**FORMA_LEARN_CANDIDATE payload:**
```typescript
{
  normalizedLabel: string;
  enteredValue: string;
}
```

---

*End of SRS — Forma v1.0.0*
*This document is the authoritative reference for all development decisions. Changes to system behavior must be reflected here before implementation.*
