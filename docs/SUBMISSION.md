# AgroLeaf AI — CoU AI Hackathon 2026 Final Submission

## Team Overview (Team EU_SHADOW)
- **Team Name:** Team EU_SHADOW
- **Institution:** Eastern University
- **Members:**
  1. **মোঃ মাসুম আকন্দ (Md. Masum Akondha)** — Team Lead · Model training, deployment & features F11–F15 · Student ID: 241400049 · GitHub: [masumcit44](https://github.com/masumcit44)
  2. **তানজিল সৈকত (Tanjil Shaiket)** — Fullstack UI/UX & features F1–F5 · Student ID: 241400038 · GitHub: [tanjil74432](https://github.com/tanjil74432)
  3. **মোঃ মেহেদী হাসান (Md. Mehedi Hasan)** — Content, Safety & features F6–F10 · Student ID: 241400054 · GitHub: [EnergiousNPC](https://github.com/EnergiousNPC)

---

## Submission Details (Rule 12)
- **Repository:** https://github.com/masumcit44/AgroLeaf_AI-
- **Live Deployment:** https://agroleaf-ai-olive.vercel.app (and `npm run demo` for local fallback)

- **Demo video:** optional (Rule 12.6); not required because the public live link above is provided (Rules 11–12)
- **Test login:** none needed (no login)

- **Title:** AgroLeaf AI

<!-- Rule 12: title + description max 150 words. Paste the paragraph below as is (142 words; 144 with the title). -->
## Description

AgroLeaf AI is a Bangla-first web app that screens a rice leaf photo for five common diseases (Blast, Brown Spot, Leaf Smut, Tungro, Sheath Blight) or a healthy leaf. Our own models, trained from scratch on public Bangladeshi field datasets, run entirely in the phone's browser with ONNX Runtime Web, so the photo never leaves the device and the app works offline after the first visit. Calibrated confidence decides the answer: the likely disease, the top two with a request for a clearer photo, or an honest "আমি নিশ্চিত নই". A built-in gate warns when the photo is not a rice leaf. Results include a Bangla disease card, a heat-map, an approximate spread band, a 7-day action roadmap, offline Bangla audio and the 16123 helpline, with no pesticide names or doses. An opt-in Weather tab adds local disease-risk alerts. Internal test macro-F1: 0.894.

## Privacy (what is and is not stored)
Photos are analysed inside the phone's browser and are never sent to or stored on any server. Scan history (F9) keeps a small
thumbnail (≤ 200 KB) only in that device's own browser storage (IndexedDB); the user can delete one scan or clear all of it at any
time from the History screen. See `docs/DECISIONS.md` D13. Leaf scanning uses no location. The Weather tab asks for browser location
only when the user taps "Auto Location", rounds it to ~1 km and sends it only to Open-Meteo and Nominatim (D15, D16, D18).

---

## AI Disclosure (Rule 9 / 12)
| Tool | Who | Used for |
|---|---|---|
| Claude Code (Anthropic) | Masum | Code assistance (scaffold, ML data pipeline, Kaggle training and ONNX export scripts, web features, tests), architecture planning, PR review, CI and rule-compliance checks, docs |
| Gemini Antigravity (Google) | Masum, Tanjil, Mehedi | Feature coding on own branches, TDD tests, UI/UX redesign |
| GitHub Copilot (VS Code) | Mehedi | Code and test assistance for F9 scan history |
| ChatGPT (OpenAI) | Team | Research only (datasets, disease information, methods); no code |

**Models / APIs:** our own scratch-trained ONNX models (disease blend + not-rice gate), run in the browser with ONNX Runtime Web.
Bangla voice MP3s were pre-generated once with Microsoft Edge neural TTS (`edge-tts`, voice `bn-BD-NabanitaNeural`). The app calls
no outside AI API at run time. The Weather tab uses two free public non-AI APIs with no key: Open-Meteo (forecast) and OpenStreetMap Nominatim (area name).
No other AI coding tool was used (no Kilo Code, no Cursor). No old code and no pretrained checkpoint was used; all code was written from 21 Nov in this repo.
