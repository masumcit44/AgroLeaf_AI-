# AgroLeaf AI — QA & Test Report (F10)

**Author:** Md. Mehedi Hasan (`EnergiousNPC`), Team `EU_SHADOW`  
**Run date:** 23 November 2026  
**Model tested:** `v1-blend-p2-p3-scratch` (before the M3 not-rice gate). `main` now ships `v2-blend-p2-p3-scratch-gate`, so the real-photo and not-rice observations below must be re-run on v2.  
**Scope:** Synthetic unit rules and real-browser inference on the six licensed sample images. This is not a report of 35 real-photo checks.

## How to read this report

"How tested" uses the required labels:

- `unit rule test (synthetic data)` means a unit test exercised a validation, image-quality, or tier rule with generated pixels/files/probabilities. It does not mean the model analyzed a photo.
- `e2e (real photo)` means the real app flow uploaded a JPG and displayed an on-device model result. Predictions below are the observed UI output, not accuracy claims.
- `NOT RUN — needs real photo` means that specific scenario has not been tested with a matching real photo. `pending` in `fixtures.json` marks missing photos.

The six files under `web/e2e/fixtures/images/` are resized copies of the test-split samples in `web/public/samples/`. Five are RiceLeafDiseaseBD v3 (CC BY 4.0); `blast.jpg` is BanglaRiceLeaf (CC0 1.0). Their original attribution is in `web/public/samples/samples.json`. Each copied JPG is under 300 KB.

## Scenario results (35 catalog entries; not 35 executed photo tests)

| ID | Scenario | Observed result | How tested |
|:---|:---|:---|:---|
| EC-01 | `healthy_leaf_natural` | Healthy / high / 98% | e2e (real photo) |
| EC-02 | `healthy_leaf_morning_dew` | NOT RUN — needs real photo | NOT RUN — needs real photo |
| EC-03 | `blast_leaf_early_spindle` | Blast / high / 98% | e2e (real photo) |
| EC-04 | `blast_leaf_multiple_lesions` | NOT RUN — needs real photo | NOT RUN — needs real photo |
| EC-05 | `brown_spot_dense` | Tungro / high / 97% (incorrect class for this sample) | e2e (real photo) |
| EC-06 | `brown_spot_faint` | Medium-tier decision rule passed on synthetic probabilities; no photo prediction | unit rule test (synthetic data) |
| EC-07 | `leaf_smut_black_spots` | Low tier / "আমি নিশ্চিত নই"; class and confidence are not shown in this UI state | e2e (real photo) |
| EC-08 | `leaf_smut_scattered` | NOT RUN — needs real photo | NOT RUN — needs real photo |
| EC-09 | `sheath_blight_lesion` | Sheath blight / high / 97% | e2e (real photo) |
| EC-10 | `sheath_blight_advanced` | NOT RUN — needs real photo | NOT RUN — needs real photo |
| EC-11 | `tungro_yellow_orange` | Tungro / high / 98% | e2e (real photo) |
| EC-12 | `tungro_stunted_leaf` | NOT RUN — needs real photo | NOT RUN — needs real photo |
| EC-13 | `blur_motion_slight` | Blurry rule passed using one generated gradient; no real blur photo tested | unit rule test (synthetic data) |
| EC-14 | `blur_severe_out_of_focus` | Blurry rule passed using one generated gradient; no real blur photo tested | unit rule test (synthetic data) |
| EC-15 | `blur_hand_shake` | Blurry rule passed using one generated gradient; no real blur photo tested | unit rule test (synthetic data) |
| EC-16 | `blur_dirty_lens` | Blurry rule passed using one generated gradient; no real blur photo tested | unit rule test (synthetic data) |
| EC-17 | `blur_raindrops_on_lens` | Blurry rule passed using one generated gradient; no real blur photo tested | unit rule test (synthetic data) |
| EC-18 | `blur_macro_too_close` | Blurry rule passed using one generated gradient; no real blur photo tested | unit rule test (synthetic data) |
| EC-19 | `dark_dusk_evening` | Dark-image rule passed using generated pixels; no dusk photo tested | unit rule test (synthetic data) |
| EC-20 | `dark_cloudy_overcast` | Dark-image rule passed using generated pixels; no cloudy photo tested | unit rule test (synthetic data) |
| EC-21 | `dark_shadow_farmer` | Dark-image rule passed using generated pixels; no shadow photo tested | unit rule test (synthetic data) |
| EC-22 | `dark_indoor_room` | Dark-image rule passed using generated pixels; no indoor photo tested | unit rule test (synthetic data) |
| EC-23 | `dark_night_flash_off` | Dark-image rule passed using generated pixels; no night photo tested | unit rule test (synthetic data) |
| EC-24 | `dark_under_canopy` | Dark-image rule passed using generated pixels; no canopy photo tested | unit rule test (synthetic data) |
| EC-25 | `bright_direct_sunlight` | Bright-image rule passed using generated pixels; no sunlight photo tested | unit rule test (synthetic data) |
| EC-26 | `bright_phone_flash_glare` | Bright-image rule passed using generated pixels; no flash photo tested | unit rule test (synthetic data) |
| EC-27 | `bright_white_background_washout` | Bright-image rule passed using generated pixels; no washout photo tested | unit rule test (synthetic data) |
| EC-28 | `bright_specular_dew_reflection` | Bright-image rule passed using generated pixels; no reflection photo tested | unit rule test (synthetic data) |
| EC-29 | `not_rice_weed_leaf` | `not_rice` tier rule passed with hand-written probabilities; no photo inference | unit rule test (synthetic data) |
| EC-30 | `not_rice_farmer_hand` | NOT RUN — needs real photo | NOT RUN — needs real photo |
| EC-31 | `not_rice_mud_ground` | NOT RUN — needs real photo | NOT RUN — needs real photo |
| EC-32 | `not_rice_sky_background` | NOT RUN — needs real photo | NOT RUN — needs real photo |
| EC-33 | `not_rice_blank_noise` | NOT RUN — needs real photo | NOT RUN — needs real photo |
| EC-34 | `oversized_file_11mb` | File-size validation rule passed with a generated file | unit rule test (synthetic data) |
| EC-35 | `invalid_extension_document` | Extension/MIME validation rule passed with a generated file | unit rule test (synthetic data) |

### Real-photo observations

The six licensed sample photos were run through the built app in Chromium at 375px and desktop. Both viewports showed the same result:

| File | Observed class / screen | Tier | Confidence shown |
|:---|:---|:---|:---|
| `healthy.jpg` | Healthy (`সুস্থ ধানগাছ`) | high | 98% |
| `blast.jpg` | Blast (`ব্লাস্ট রোগ`) | high | 98% |
| `brown_spot.jpg` | Tungro (`টুংরো রোগ`) | high | 97% |
| `leaf_smut.jpg` | "আমি নিশ্চিত নই" | low | Not shown |
| `sheath_blight.jpg` | Sheath blight (`খোলপোড়া রোগ`) | high | 97% |
| `tungro.jpg` | Tungro (`টুংরো রোগ`) | high | 98% |

The brown-spot sample was misclassified as Tungro; this is recorded as observed, not counted as a correct prediction. The low-tier screen does not expose its top class or confidence.

### Not-rice synthetic image observation (e2e test 7)

A synthetic sky-blue patch (`not_rice_sky.jpg`, 224×224 JPEG, plain blue pixels) was uploaded via e2e test 7. The model returned **"Healthy / 84%" (high tier)**. The model did **not** output the `not_rice` tier for this synthetic image. This is recorded honestly. The safety tokens (`প্রাথমিক স্ক্রিনিং`, `১৬১২৩`) were present on the result screen. A real team-taken not-rice photo was not available; `grass.jpg` is marked `pending` in `fixtures.json`.

## Latest test output

Run on 23 November 2026 in `web/` after merging `origin/main` (merge commit `183fc9f`):

### Unit tests (`npm test`)

```
 Test Files  33 passed (33)
      Tests  191 passed (191)
   Start at  00:00:21
   Duration  27.32s (environment 61%, setup 21%, tests 7%, import 6%, transform 4%, worker 1%)
```

### End-to-end tests (`npm run test:e2e`)

```
Running 16 tests using 6 workers

  ok  1 [Mobile Phone (375px)] › app.spec.ts:32 › 1. App shell loads … (1.8s)
  ok  2 [Mobile Phone (375px)] › app.spec.ts:51 › 2. Hash routing … (3.6s)
  ok  3 [Mobile Phone (375px)] › app.spec.ts:75 › 3. History screen … (3.1s)
  ok  4 [Mobile Phone (375px)] › app.spec.ts:91 › 4. Sample gallery … (3.3s)
  ok  5 [Mobile Phone (375px)] › app.spec.ts:108 › 5. Uploads a real blast photo … (5.5s)
  ok  6 [Mobile Phone (375px)] › app.spec.ts:128 › 6. Runs inference on other class photos (12.7s)
  ok  7 [Mobile Phone (375px)] › app.spec.ts:160 › 7. Uploads a not-rice photo … (5.5s)
  ok  8 [Mobile Phone (375px)] › app.spec.ts:185 › 8. Rejects non-image files … (1.2s)
  ok  9 [Desktop Chrome] › app.spec.ts:32 › 1. App shell loads … (1.3s)
  ok 10 [Desktop Chrome] › app.spec.ts:51 › 2. Hash routing … (1.8s)
  ok 11 [Desktop Chrome] › app.spec.ts:75 › 3. History screen … (1.0s)
  ok 12 [Desktop Chrome] › app.spec.ts:91 › 4. Sample gallery … (1.1s)
  ok 13 [Desktop Chrome] › app.spec.ts:108 › 5. Uploads a real blast photo … (5.5s)
  ok 14 [Desktop Chrome] › app.spec.ts:128 › 6. Runs inference on other class photos (8.8s)
  ok 15 [Desktop Chrome] › app.spec.ts:160 › 7. Uploads a not-rice photo … (5.4s)
  ok 16 [Desktop Chrome] › app.spec.ts:185 › 8. Rejects non-image files … (1.0s)

  16 passed (24.0s)
```

### Lint and build

```
> oxlint
Found 0 warnings and 0 errors.
Finished in 90ms on 83 files with 116 rules using 12 threads.
```

```
> tsc -b && vite build
✓ 61 modules transformed.
dist/index.html  1.09 kB │ gzip: 0.58 kB
dist/assets/main-DSDfWW8w.js  347.68 kB │ gzip: 101.27 kB
✓ built in 594ms
```

## v2 re-check (added by Md. Masum Akondha, 23 Nov night)

Re-run of the real-photo checks on the shipped `v2-blend-p2-p3-scratch-gate`, with Python ONNX Runtime and `ml/agroleaf_ml/preprocess.py` (the browser matches it within 1e-4, `web/src/ai/model.parity.test.ts`).

- The six gallery samples in `web/public/samples/` (test split; `brown_spot.jpg` was replaced in #37): **6 / 6 correct, all high tier** (0.97–0.996).
- Onsite demo pack (30 test-split photos, 5 per class, kept outside the repo with their sources): **25 / 30 correct top-1**; 2 go to "আমি নিশ্চিত নই"; 3 are confident mistakes (1 Brown Spot → Tungro, 2 Leaf Smut → Blast / Brown Spot), in line with the per-class F1 in `docs/MODEL_REPORT.md`.
- Real not-rice photos (sky, hand, mango leaf, coffee mug, brick wall; Wikimedia Commons): **5 / 5 rejected** as "এটি ধানপাতা মনে হচ্ছে না" (p_not_rice ≥ 0.999). One banana-leaf photo was **not** rejected (Brown Spot 0.69), matching the known ~1-in-4 other-crop leak. The v1 "blue sky → Healthy 84%" observation above did not repeat with a real sky photo on v2.

