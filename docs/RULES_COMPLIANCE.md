# Rule compliance checklist (CoU AI Hackathon 2026 rule book, revised 12 Nov)

Lead re-checks this before every merge to main and before submission. Last full audit: 23 Nov 2026, night BST (main at #50 + final docs sync).
☑ = checked on that date. ☐ = to do on 24 Nov.

| Rule | Requirement | How we comply | ✓ |
|---|---|---|---|
| 7 | Every member shows the original student ID at check-in (8:45 AM) | Masum 241400049, Tanjil 241400038, Mehedi 241400054 bring their original ID cards | ☐ |
| 7 | Bring own laptops, chargers, backup mobile data; no outside help | Own laptops + phone hotspot; only the 3 registered members work on the repo | ☐ |
| 8 | Code only from 21 Nov; no reuse of old projects; libraries listed | New repo; first commit `9a490b9` on 22 Nov 00:19 BST; the earlier AgroLeaf (AIgnite) work was used for ideas only, no code copied; libraries, APIs and assets in README §5, §10 and `docs/CREDITS.md` | ☑ |
| 9 | Disclose every AI coding tool | README §7, `docs/CREDITS.md` §5 and `docs/SUBMISSION.md`: Claude Code (Masum), Gemini Antigravity (all three), GitHub Copilot in VS Code (Mehedi), ChatGPT (research only). No other AI coding tool (no Kilo Code, no Cursor) | ☑ |
| 9 | Name every model and API | Our scratch-trained ONNX model (disease blend + not-rice gate); Microsoft Edge neural TTS (`edge-tts`) used once offline for the Bangla MP3s; Open-Meteo and OpenStreetMap Nominatim (Weather tab only, no key) | ☑ |
| 9 | Real AI only | Predictions come only from `agroleaf.onnx`; mocks only in tests | ☑ |
| 9 | Data public/licensed and credited | 6 datasets (CC BY 4.0 / CC0 / COCO's permissive subset), all in README §6 and `docs/CREDITS.md` | ☑ |
| 10 | One public repo, regular commits from each member's account, no force-push/squash/back-dating | Merge commits only; Masum, Tanjil and Mehedi each commit from their own account; history never rewritten | ☑ |
| 10 | Hourly commits during the final (24 Nov) | Every member commits at least once an hour, 9 AM to 1 PM | ☐ |
| 10 | No keys committed; `.env.example` | No secrets needed (Open-Meteo and Nominatim need no key); `.env.example` says so; `.gitignore` covers `.env`, `kaggle.json`, `.vercel/` | ☑ |
| 10 | README items | Team, members and roles; problem/solution; features (F1–F18) and how the AI works; stack, models, APIs, datasets; AI tools and what for; third-party credits; setup; live link; demo video marked optional (Rule 12.6) | ☑ |
| 11 | Public deployment that stays live; live demo runs the real project; local copy | Vercel (root `web`) + local fallback `npm run demo` + offline PWA; a local screen recording is kept only as a network backup | ☑ |
| 11 | Login → test credentials | No login, so none needed | ☑ |
| 12 | Final submission: ≤150-word description, repo link, live link, AI disclosure; video optional | `docs/SUBMISSION.md` (description word count checked by `web/src/docs/s3.test.ts`) | ☑ |
| 12 | Submit at least 10 minutes early, by the leader | Masum submits by 12:40 PM on 24 Nov | ☐ |
| 13 | No rewritten history, no post-deadline changes, no faked demo | Merge commits only; only minor pushes 1–2 PM, nothing after; the demo runs the real model | ☐ |
| Privacy | Leaf scanning uses no location; Weather tab uses opt-in GPS rounded to ~1 km | Scanning has zero location; the Weather tab asks for browser location only on "Auto Location", rounds it to 2 decimals (~1 km), sends it only to Open-Meteo and Nominatim, stores it only in localStorage; Dhaka fallback if denied (D15, D16, D18) | ☑ |
| Organiser notice | Fully working prototype that runs locally | `npm run demo` rehearsal without internet | ☐ |
