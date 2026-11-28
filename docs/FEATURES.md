# Feature tracker — AgroLeaf AI

Model work (M1–M8) belongs to the team lead. The other 15 features are split equally (5 each), plus one shared deliverable each.
Status: `todo` → `in-progress` → `in-review` (PR open) → `merged` → `verified`. Full spec of each item: `docs/specs/<ID>.md`.
Every item: Understand → Plan → **Tests first** → Implement → PR → Review → Merge (merge commit) → Deploy → Verify.

## Checkpoints (Bangladesh time)
- **CP0 — ২২ নভেম্বর, দুপুর ১২:০০:** সবাই invite accept, repo clone, নিজের PC-তে `npm test` সবুজ, প্রথম feature-এর branch খোলা
- **CP1 — ২২ নভেম্বর, সন্ধ্যা ৬:০০:** Model v0 repo-তে; প্রত্যেকের প্রথম MUST feature merged; ছবি দিয়ে Analyze করলে আসল ফল আসে
- **CP2 — ২২ নভেম্বর, রাত ১১:০০:** সব MUST feature merged; Vercel live link ফোনে কাজ করে
- **CP3 — ২৩ নভেম্বর, দুপুর ১:০০:** সব SHOULD feature merged; final model v1 + report
- **CP4 — ২৩ নভেম্বর, সন্ধ্যা ৬:০০:** FEATURE FREEZE: README, demo video, pitch, local fallback (Wi-Fi ছাড়া) rehearsal

## Model track — Md. Masum Akondha

| ID | Item | Deadline | Branch | Status |
|---|---|---|---|---|
| M1 | Dataset pipeline: পরিষ্কার করা ও ভাগ করা | CP1 | `feat/M1-data-split` | merged (#24, ml/data/) |
| M2 | শূন্য থেকে model training (Kaggle GPU) | CP1 (v0), CP3 (v1) | `feat/M2-train` | merged (#14) |
| M3 | "ধানপাতা নয়" চেনা (not_rice class) | CP3 | `feat/M3-not-rice` | merged (#29, #31) |
| M4 | Calibration: confidence-কে সৎ করা | CP3 | `feat/M4-calibration` | merged (#17) |
| M5 | Evaluation ও model report | CP3 | `feat/M5-report` | merged (#16, docs/MODEL_REPORT.md) |
| M6 | ONNX export + parity test | CP1 (v0), CP3 | `feat/M6-export` | merged (#16) |
| M7 | Browser inference engine (web/src/ai) | CP1 | `feat/M7-engine` | merged (#3) |
| M8 | Deployment: Vercel, CI, local fallback | CP2 | `feat/M8-deploy` | merged (#8, #15) |

## Md. Masum Akondha

| ID | Feature | Priority | Deadline | Branch | Status |
|---|---|---|---|---|---|
| F11 | "কেন এই উত্তর?" heat-map | SHOULD | CP3 | `feat/F11-heatmap` | merged (#11) |
| F12 | "AI কীভাবে কাজ করে" + Accuracy page | MUST | CP3 | `feat/F12-accuracy-page` | merged (#2) |
| F13 | নমুনা ছবি gallery (judges-দের জন্য) | SHOULD | CP3 | `feat/F13-sample-gallery` | merged (#20) |
| F14 | Offline PWA (install করা যায়) | SHOULD | CP3 | `feat/F14-offline-pwa` | merged (#9) |
| F15 | কৃষি কর্মকর্তার জন্য case summary | SHOULD | CP3 | `feat/F15-case-summary` | merged (#10) |
| F16 | আবহাওয়া ট্যাব: রোগ-ঝুঁকি + ফসল-পর্যায়ক্রম (opt-in ~1 km GPS, Open-Meteo, এলাকার নাম Nominatim) | SHOULD | CP3 | `feat/F16-weather-tab-gps` | merged (#41, #42; area name + location pill #49, #50) |
| S3 | Pitch ও final submission | MUST | CP4 | `docs/S3-pitch-submission` | merged (#12) |

## Tanjil Shaiket

| ID | Feature | Priority | Deadline | Branch | Status |
|---|---|---|---|---|---|
| F1 | App shell ও design system | MUST | CP1 | `feat/F1-app-shell` | merged (#1; UI/UX redesign #33, #45–#47; full bn/en #50) |
| F2 | ছবি নেওয়া: gallery + camera + preview | MUST | CP1 | `feat/F2-photo-input` | merged (#5) |
| F3 | ছবির মান যাচাই (অন্ধকার / ঝাপসা) | MUST | CP2 | `feat/F3-photo-quality` | merged (#6, via #22) |
| F4 | Analyze flow ও ফলাফলের screen (৪টি tier) | MUST | CP2 | `feat/F4-result-screens` | merged (#13, via #22) |
| F5 | বাংলা / English toggle | SHOULD | CP3 | `feat/F5-language-toggle` | merged (#28) |
| F17 | করণীয় রোডম্যাপ (পরবর্তী ৭ দিন) | SHOULD | CP3 | `feat/F17-action-roadmap` | merged (#48) |
| S2 | ৩ মিনিটের demo video | Optional (Rule 12.6; public live link exists) | CP4 | `docs/S2-demo-video` | optional, not required |

## Md. Mehedi Hasan

| ID | Feature | Priority | Deadline | Branch | Status |
|---|---|---|---|---|---|
| F6 | বাংলা + English রোগের card (সূত্রসহ) | MUST | CP1 | `feat/F6-disease-cards` | merged (#4) |
| F7 | Safety layer: disclaimer + ১৬১২৩ | MUST | CP1 | `feat/F7-safety-disclaimer` | merged (#7) |
| F8 | বাংলায় ফল পড়ে শোনানো | SHOULD | CP3 | `feat/F8-voice-readout` | merged (#23, #34, #36) |
| F9 | Scan ইতিহাস (শুধু নিজের ফোনে) | SHOULD | CP3 | `feat/F9-scan-history` | merged (#25, #35) |
| F10 | QA: edge-case ছবি সেট + end-to-end test | MUST | CP2–CP4 | `feat/F10-qa-e2e` | merged (#26) |
| F18 | আনুমানিক আক্রান্ত এলাকা + ১৬১২৩ জরুরি সংকেত | SHOULD | CP3 | `feat/F18-severity-estimate` | merged (#44) |
| S1 | README (সব নিয়ম মেনে) | MUST | CP4 | `docs/S1-readme` | merged (#27) |

## Onsite Final Challenges (২৪ নভেম্বর ২০২৬)

| ID | Feature | Responsibility & Ownership | Branch | Status |
|---|---|---|---|---|
| C1 | মাঠের সারি স্ক্যান (Field-row screening) | Engine: Masum · UI: Tanjil · Copy/QA/Docs: Mehedi | `feat/onsite-contract`, `feat/onsite-field-engine-and-ood`, `feat/onsite-field-row-ui`, `feat/onsite-copy-qa-docs` | merged (#53, #54, #56, #57, #58) |
| C2 | দায়িত্বশীল অ্যাবস্টেনশন (Honest Abstention) | Engine: Masum · UI: Tanjil · Copy/QA/Docs: Mehedi | `feat/onsite-field-engine-and-ood`, `feat/onsite-copy-qa-docs` | merged (#54, #56, #58) |
