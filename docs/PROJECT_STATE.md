# Project state

_Last updated: 23 Nov 2026, night BST (main at #50 + final docs sync). Feature freeze is over: only bug fixes and docs on 24 Nov._

- **Live:** https://agroleaf-ai-olive.vercel.app (Vercel project `agroleaf-ai`, root `web`, deploys from `main`). No login. Local fallback: `cd web && npm ci && npm run demo` (port 4173, reachable from a phone on the same hotspot).
- **Model:** `web/public/model/agroleaf.onnx`, version `v2-blend-p2-p3-scratch-gate`, 16.6 MB. Scratch-trained P2 (MobileNetV3-Large-CAM) + P3 (RegNetY-400MF) per-class blend + M3 not-rice gate in one graph. Internal test macro-F1 0.894 (6-class with gate 0.8925). See `docs/MODEL_REPORT.md`.
- **Features:** all MUST and SHOULD features merged: F1–F15, F16 Weather tab (#41, #42, #49, #50), F17 Roadmap (#48), F18 Severity + 16123 (#44), M1–M8, S1, S3, full Bangla/English UI (#50). See `docs/FEATURES.md`.
- **Demo video (S2):** optional under Rule 12.6, because the public live link is the required item (Rules 11–12).
- **Checks (23 Nov night, docs-sync branch on top of main #50):** `npm run lint` clean, `npm test` 55 files / 399 tests pass, `npm run build` OK.
- **Final day 24 Nov:** 9:00 AM start, every member commits from their own account at least once an hour, submit by 12:40 PM (hard deadline 1:00 PM).

## Open risks
| Risk | Mitigation | Owner |
|---|---|---|
| Photos of a screen score lower (macro-F1 ≈ 0.65) | Tiers + "not sure"; said openly in README and MODEL_REPORT. A screen-recapture fine-tune was tried and **not shipped** (clean test fell below our 0.890 rule, D17) | Masum |
| Venue Wi-Fi fails | PWA works offline after first load; `npm run demo` on a laptop + phone on the same hotspot; local screen recording as backup (Rule 11) | Masum |
| Other crops' leaves pass the gate (~1 in 4) | Stated in MODEL_REPORT; 16123 referral on every result | Masum |
| Weather tab needs internet | Last forecast is cached and shown offline; scanning never needs the Weather tab | Masum |
