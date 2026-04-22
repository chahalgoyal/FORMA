# Forma ⚡ — Smart Placement Form Autofill

**Forma** is a premium, privacy-first Chrome extension designed specifically for students navigating the repetitive world of campus placement and internship drives. It transforms the tedious task of filling out near-identical Google Forms into a single-click, "cozy" experience.

---

## 🚀 Why Forma?

Students at institutions like **Chandigarh University (CU)** and **Chandigarh Group of Colleges (CGC)** often find themselves filling out the same personal, academic, and placement details for dozens of different companies. 

Forma is not just an autofiller; it's a **smart assistant** that:
- **Learns your intent:** It understands that "Enrollment ID", "Roll Number", and "UID" often mean the same thing.
- **Prioritizes accuracy:** It only fills fields when it is highly confident, highlighting what it did so you stay in control.
- **Respects your privacy:** All your data stays 100% local. No servers, no tracking, no data leaks.

---

## ✨ Key Features

- **🧠 Three-Layer Matching Engine:** Combines exact keywords, fuzzy search (via Fuse.js), and structural logic to map form labels to your profile.
- **🌱 Adaptive Learning:** If you correct a field, Forma asks if it should remember that mapping for every future form you encounter.
- **📋 Rich Student Profiles:** Store everything from basic contact info to specific 10th/12th board marks, CGPA, and backlog details.
- **⚡ Intent-First Filling:** Intelligently handles text inputs, radio groups, and complex Google Forms dropdowns (listboxes).
- **🎨 Cozy Organic UI:** A bespoke, hand-crafted interface designed to be eye-friendly and approachable, moving away from sterile AI aesthetics.
- **✅ Visual Feedback:** Clear green/yellow highlighting on the form itself to show exactly what was filled and what requires your attention.

---

## 🎨 Premium Design System

Forma features a unique **"Cozy Organic"** design system. Moving away from standard SaaS boilerplate, we've implemented:
- **Warm, Earthy Palette:** Soft beiges, sage greens, and dark wood tones to reduce eye strain.
- **Fluid Typography:** Using the `Outfit` font for a modern yet approachable feel.
- **Minimalist Layout:** A plaque-style header with subtle "rivet" details and a clean, distraction-free options page.

---

## 🧠 How the Brain Works

Forma uses a sophisticated matching pipeline:
1. **Static & Learned Mappings:** Checks if the label has been seen before or is in the core library.
2. **Fuzzy Matching:** Uses Fuse.js to handle typos, word-order variations, and synonymous labels.
3. **Structural Analysis:** Detects constraints like "Personal Email only" or "10-digit number without country code" and adapts the data on the fly.

---

---

## 📥 Quick Install (For Users)

If you just want to use Forma, you don't need to touch any code or use the command line:
1. **Download the Extension:** Once live, find us on the [Chrome Web Store](https://chrome.google.com/webstore).
2. **One-Click Install:** Click "Add to Chrome."
3. **Pin it:** Click the puzzle icon in your browser and pin Forma for easy access.
4. **Fill your Profile:** Open the extension, click "Edit Profile," and you're ready to autofill!

---

## 🛠️ Developer Setup (For Contributors)

> [!NOTE]
> These steps are **only** for people who want to modify the source code or build the extension from scratch. Regular users can skip this!

### Prerequisites
- Node.js (v18+)
- Chrome Browser

### Build from Source
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the `dist` folder.

---

## 🔒 Privacy & Security

- **Manifest V3:** Fully compliant with the latest Chrome extension standards.
- **Local Only:** Data is stored in `chrome.storage.local`. Nothing is ever sent to a server.
- **No Third-Party Scripts:** Even the matching engine (Fuse.js) is bundled locally to ensure zero external network calls.

---

## 🤝 Developed By

Developed with ❤️ by **[Chahal Goyal](https://www.linkedin.com/in/chahalgoyal/)**.

Check out my [GitHub](https://github.com/chahalgoyal) for more projects!

---

*Forma is not affiliated with Google or Google Forms. It is an independent productivity tool.*
