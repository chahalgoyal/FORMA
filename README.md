<div align="center">
<img src="./assets/logo-forma.png" width="80" alt="Forma Logo" />

# FORMA

### A privacy-first, intent-aware autofill assistant for students.

[![Version](https://img.shields.io/badge/Version-1.1.0-blue?style=for-the-badge)](https://github.com/chahalgoyal/FORMA/releases/latest)
[![Download ZIP](https://img.shields.io/badge/Download-ZIP%20Release-blueviolet?style=for-the-badge&logo=archive)](https://github.com/chahalgoyal/FORMA/releases/latest)
[![Manifest V3](https://img.shields.io/badge/Chrome-MV3-orange?style=for-the-badge&logo=google-chrome)](https://developer.chrome.com/docs/extensions/mv3)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Privacy First](https://img.shields.io/badge/Privacy-Local%20Only-success?style=for-the-badge&logo=shield)](https://github.com/chahalgoyal/FORMA)

</div>

---

> **Forma** is a premium, intent-driven browser extension designed to eliminate the friction of campus placement drives. Built for students at institutions like **Chandigarh University (CU)**, it replaces tedious data entry with a "cozy," single-click experience that values accuracy and privacy above all else.

---

## 📸 Experience Walkthrough


### Smart Matching Engine
Forma doesn't just look for exact labels; it understands **intent**.
- **Keyword Matching:** Handles direct hits like "First Name" or "UID."
- **Fuzzy Search:** Powered by **Fuse.js**, it handles typos and synonyms like "Enrollment Number" vs "Roll No."
- **Structural Analysis:** Intelligently detects constraints like "without country code" or "10-digit number."

### Adaptive Learning
When you manually correct a field, Forma notices. It performs a **reverse-lookup** into your profile and asks if it should remember that specific mapping for every future form you encounter.

### The "Cozy Organic" Interface
Forma moves away from sterile, boxy AI designs. The popup and options pages use a **warm, earthy palette** and a unique **plaque-style design** that feels tactile and approachable.
---

## ✨ Full Feature List

### 🧠 Matching & Intelligence
- ✅ **Three-Layer Pipeline:** Keyword → Fuzzy → Structural.
- ✅ **Constraint Awareness:** Detects phone number formats and email types.
- ✅ **Adaptive Learning:** Learns from user corrections in real-time.
- ✅ **Disambiguation:** Knows the difference between "10th Board" and "12th Board" based on context.

### 🎨 UI / UX
- ✅ **Cozy Organic Theme:** Sage green accents, warm beige backgrounds.
- ✅ **Visual Feedback:** 5px side-line indicators and subtle ghost-tint backgrounds.
- ✅ **Real-time Status:** Shows exactly how many fields were filled vs. skipped.
- ✅ **Highlight Clearing:** One-click removal of all visual highlights.
- ✅ **Flexible Profile:** No mandatory fields — fill only what you need, save anytime.

### 🔒 Privacy & Performance
- ✅ **Local-Only Storage:** All profile data stays on your machine (`chrome.storage.local`).
- ✅ **Manifest V3:** Compliant with the latest secure extension standards.
- ✅ **Zero Latency:** No external API calls; matching happens instantly in-browser.
- ✅ **Zero Bloat:** Bundled with **esbuild** for a tiny, fast footprint.

---

## 🏗️ Technical Architecture

```
┌───────────────────────────────────────────────────────────┐
│                     CHROME EXTENSION                      │
│  ┌──────────────┐      ┌──────────────┐      ┌─────────┐  │
│  │    Popup     │ ◄─── │  Storage     │ ───► │ Options │  │
│  │ (User UI)    │      │ (Local JSON) │      │ (Editor)│  │
│  └──────────────┘      └──────────────┘      └─────────┘  │
└──────────┬────────────────────────────────────────────────┘
           │ Messaging API
           ▼
┌───────────────────────────────────────────────────────────┐
│                     CONTENT SCRIPT                        │
│  ┌──────────────┐      ┌──────────────┐      ┌─────────┐  │
│  │  DOM Parser  │ ───► │ Smart Matcher│ ───► │ Filler  │  │
│  │ (Scans Form) │      │ (Three-Layer)│      │ (Logic) │  │
│  └──────────────┘      └──────────────┘      └─────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## 🚀 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Core** | TypeScript | Type-safe form mapping and state management |
| **Matching** | Fuse.js | High-performance fuzzy string searching |
| **Build** | esbuild | Sub-millisecond bundling for fast development |
| **Storage** | Chrome Storage API | Secure, per-profile local persistence |
| **Styling** | Vanilla CSS + HSL | Maximum control over the "Cozy Organic" theme |

---

## ⚡ Setup & Installation

### 📥 Quick Install (For Users)
If you aren't a developer, the easiest way to use Forma is via the ZIP release:

1. **Download:** Click the **[Download ZIP](https://github.com/chahalgoyal/FORMA/releases/latest)** badge at the top.
2. **Extract:** Unzip the `forma-extension.zip` folder to a safe location.
3. **Load in Chrome:** 
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer mode** (top-right).
   - Click **Load unpacked** and select the folder you just extracted.
4. **Pin it:** Click the puzzle icon in your browser and pin Forma.

---

## 📖 How to Use

### 1. Setup your Profile
When you first install Forma, click **Edit Profile** in the extension popup to get started. You'll be taken to a dedicated Profile Studio page.

### 2. Fill & Save Details
Enter your academic and personal details in the "Cozy Organic" editor. There are no mandatory fields—fill out as much or as little as you want, and click **Save Profile** when you're done.

### 3. Autofill Anywhere
Open any Google Form (like a placement or internship application) and click the **Autofill This Form** button in the Forma popup. You can also enable **Autofill on page load** using the toggle for a complete zero-click experience.

### 4. Review & Clear
Forma will intelligently match and fill the form fields, highlighting them in a soft Sage Green so you can easily review what was changed. The popup will show you exactly how many fields were successfully filled or skipped. Once you've reviewed the form, you can clear the highlights with one click.

---

### 🛠️ Developer Setup (For Contributors)
```bash
# 1. Clone the repository
git clone https://github.com/chahalgoyal/FORMA.git

# 2. Install dependencies
npm install

# 3. Build the extension
npm run build
```
Load into Chrome: Go to `chrome://extensions/` → Enable **Developer mode** → **Load unpacked** → Select the `dist` folder.

---

## 📋 Changelog

### v1.1.0 — UI Polish & Precision Updates
- **Visual Overhaul:** Refined the "Cozy Organic" UI to perfectly align the new branding and typography without layout distortions.
- **Improved Iconography:** Cleaned up transparent padding on the extension icon to ensure perfect visibility in the Chrome toolbar.
- **Enhanced Matcher Logic:** Polished handling of ambiguous slash-separated fields.
- **Automated Bundling:** Streamlined the build pipeline for faster developer iterations and pristine ZIP output.

### v1.0.1 — User Feedback Release
- **No mandatory fields** — All profile fields are now optional. Fill only what you need, save anytime. Empty fields are gracefully skipped during autofill.
- **Soft validation** — Phone number format is validated only when you actually enter a phone number.
- **Housekeeping** — Build artifacts (`.zip`) removed from version control.

### v1.0.0 — Initial Release
- Three-layer matching engine (Keyword → Fuzzy → Structural)
- Adaptive learning from user corrections
- Constraint-aware filling (phone formats, email types)
- Cozy Organic theme with warm, earthy palette
- Privacy-first, local-only storage

---

## Author

<div align="center">

**Chahal Goyal**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-chahalgoyal-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/chahalgoyal/)
[![GitHub](https://img.shields.io/badge/GitHub-chahalgoyal-181717?style=for-the-badge&logo=github)](https://github.com/chahalgoyal)

</div>

---

<div align="center">
  <sub>Built with precision and purpose. For the students, by a student.</sub>
</div>
