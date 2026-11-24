# Model report (M5) — v1-blend-p2-p3-scratch (+ M3 gate = shipped `v2-blend-p2-p3-scratch-gate`)

The live app ships `v2-blend-p2-p3-scratch-gate`: the disease blend below, unchanged, plus the M3 not-rice gate folded into the same ONNX (last section).

All models are trained **from random initialisation** (`pretrained=False`) on the AgroLeaf AI unified dataset build v2
(train 8,863 / val 1,902 / internal test 1,901 / external BD5 2,671). Augmentation profile **A0_baseline** (winner of the
A0/A1/A2 ablation on validation). Checkpoint, blend weights, temperature and tier thresholds were chosen on **validation only**;
internal test and BD5 were scored once afterwards. Code: `ml/kaggle/top3/`.

| Model | Params | ONNX MB | Val macro-F1 | Test macro-F1 | Leaf Smut recall val / test | BD5 4-class macro-F1 | Test ECE (after T) |
|---|---|---|---|---|---|---|---|
| P1 AgroFusedNet-M | 3.69M | 14.8 | 0.908 | 0.880 | 0.78 / 0.69 | 0.268 | 0.050 |
| P2 MobileNetV3-Large-CAM | 4.21M | 16.9 | 0.903 | 0.877 | 0.73 / 0.69 | 0.233 | 0.037 |
| P3 RegNetY-400MF | 3.91M | 15.6 | 0.896 | 0.888 | 0.79 / 0.77 | 0.383 | 0.028 |
| **Blend P2+P3 (deployed)** | 8.12M | 16.3 (FP16 weights; 16.6 with the M3 gate) | 0.910 | 0.894 | 0.78 / 0.78 | 0.371 | 0.021 |
| Blend P1+P2+P3 | 11.81M | 23.7 (FP16 weights) | 0.910 | 0.890 | 0.78 / 0.72 | 0.328 | 0.026 |

**Why P2+P3 and not all three:** the 3-model blend tied on validation macro-F1 (0.9100 vs 0.9099) and is 7 MB larger and slower,
so the smaller blend was kept (rule fixed before looking at test).

The deployed file is one ONNX graph: both networks, the per-class blend, output `logits` (blended log-probabilities; the app
divides by T = 0.910) and `cam` [1, 6, 7, 7]. Weights are stored as FP16 and cast to FP32, so all maths is FP32.
Checks: FP32 graph vs PyTorch max |Δ| 5.7e-06; FP16-stored vs FP32 on 200 real photos max prob Δ
0.0019, top-1 agreement 100%; ONNX Runtime Web (WASM) vs Python within 1e-4 (`web/src/ai/model.parity.test.ts`).

## Blend weights (per class, validation-fitted)

| Model | healthy | blast | brown_spot | leaf_smut | tungro | sheath_blight |
|---|---|---|---|---|---|---|
| P2 | 0.53 | 0.27 | 0.47 | 0.52 | 0.37 | 0.23 |
| P3 | 0.47 | 0.73 | 0.53 | 0.48 | 0.63 | 0.77 |

## Internal test, per class (calibrated)

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| healthy | 0.928 | 0.970 | 0.949 | 333 |
| blast | 0.904 | 0.897 | 0.901 | 359 |
| brown_spot | 0.855 | 0.830 | 0.842 | 376 |
| leaf_smut | 0.778 | 0.778 | 0.778 | 108 |
| tungro | 0.923 | 0.934 | 0.928 | 410 |
| sheath_blight | 0.974 | 0.956 | 0.965 | 315 |

## Internal test, confusion matrix (final shipped ONNX, gate on)

Rows = true class, columns = predicted class. 1,901 rice photos + 1,489 not-rice photos (PlantDoc + COCO test split) = 3,390.
Same numbers as `web/public/model/report.json`, which the app's Accuracy page shows.

| true \ predicted | healthy | blast | brown_spot | leaf_smut | tungro | sheath_blight | not_rice |
|---|---|---|---|---|---|---|---|
| healthy | **323** | 1 | 5 | 1 | 0 | 2 | 1 |
| blast | 6 | **321** | 17 | 5 | 7 | 2 | 1 |
| brown_spot | 9 | 19 | **310** | 14 | 20 | 1 | 3 |
| leaf_smut | 2 | 5 | 13 | **84** | 3 | 1 | 0 |
| tungro | 1 | 7 | 15 | 2 | **383** | 2 | 0 |
| sheath_blight | 7 | 1 | 3 | 2 | 1 | **298** | 3 |
| not_rice | 37 | 11 | 27 | 0 | 16 | 49 | **1349** |

Most rice errors are Brown Spot ↔ Blast / Tungro / Leaf Smut. 8 rice photos (0.42%) are wrongly sent to "not rice"; 140 not-rice
photos (9.4%) pass the gate, most often as Sheath Blight or Healthy.

## Limitations

- **BD5 (external, Savar) is weak (4-class macro-F1 0.37).** BD5 photos are detached leaves on white paper
  indoors; all training photos are field photos. Wrong answers go mostly to Blast and Sheath Blight. Photos that do not look like
  field photos are unreliable; the confidence tiers and the "not sure" answer are the safety net.
- Leaf Smut comes from one source (RiceLeafDiseaseBD v3) and is most often confused with Brown Spot.
- not_rice is handled by the M3 gate (section below), not by the disease blend.

## Confidence tiers (thresholds chosen on validation)

`high` 0.65 (≤ 5% val error), `healthyHigh` 0.72 (≥ 97% val precision for "healthy"), `medium` 0.57: below it the app says "আমি নিশ্চিত নই". 0.57 is the largest threshold where the abstained validation photos are mostly wrong (top-1 accuracy ≤ 60%) while abstaining on ≤ 5% of validation photos.

| Tier | Val coverage / accuracy | Internal test coverage / accuracy | BD5 coverage / accuracy |
|---|---|---|---|
| high | 92.8% / 95.4% | 92.5% / 94.4% | 36.5% / 37.7% |
| medium (top-2) | 2.5% / 51.1% | 2.8% / 49.1% | 16.8% / 36.6% |
| not sure | 4.7% / 56.7% | 4.7% / 43.8% | 46.8% / 35.6% |

## M3 — "ধানপাতা নয়" (not_rice) gate — v2-blend-p2-p3-scratch-gate

A small separate CNN answers "is this a rice leaf?". It is trained **from random initialisation** (`pretrained=False`,
80,353 parameters) and folded into the same `agroleaf.onnx`, so the browser still loads one file (16.6 MB, 16,637,529 bytes).
The disease blend above is **unchanged**. Code: `ml/kaggle/m3/m3_not_rice.py` (Kaggle notebook `agroleaf-m3-not-rice-gate`, v5).

**How the output is built (inside the graph):** `p6` = calibrated blend probabilities (T = 0.910 is now applied inside the graph,
so `model_meta.temperature` = 1.0). `p_nr` = gate probability, but only when the blend itself is unsure
(max disease probability < 0.98); otherwise 0. Output `logits` = log of `[p6 · (1 − p_nr), p_nr]`, 7 values;
`cam` gets an empty 7th channel. The app answers "ধানপাতা নয়" when `p_nr ≥ thresholds.notRice` (0.947).
Both the threshold and the 0.98 cap were chosen on **validation only** (rule: at most 0.1% of rice validation photos rejected,
then the most not-rice photos rejected).

**Data.** Rice = the unified dataset splits as built. Not rice (split 70/15/15, seed 42, per source):
PlantDoc (other crops' leaves, CC BY 4.0, 2,922 images) and 7,000 COCO 2017 images whose own licence is CC BY 2.0,
"no known copyright restrictions" or "United States Government Work" (non-commercial licences excluded).
**BD5 (rice leaves on white paper) was split 70/15/15 and used for the gate only**, so the gate accepts leaves photographed on
paper; the disease blend never saw BD5, so its BD5 numbers above are still an external test. Training also pastes rice leaves on
plain backgrounds (35% of rice photos) and simulates a phone photo of a laptop screen (25% of all photos: bezel, tilt, LCD grid /
moiré, cool white balance, glare, JPEG).

| Check (scored once with the final ONNX) | Result |
|---|---|
| Not-rice photos rejected | val 91.7%, test 90.6% (COCO 96.1%, PlantDoc 77.4%) |
| Rice photos wrongly rejected | val 0.05%, internal test 0.42% (8 of 1,901) |
| BD5 rice on paper wrongly rejected (held-out BD5 part, gate only) | 0% (0 of 401) |
| Rice photos shown on a screen and re-photographed (simulated), wrongly rejected | 0.05% |
| Not-rice photos on a screen, rejected (simulated) | 74% |
| 6-class internal-test macro-F1, gate off → on | 0.8937 → 0.8925 |
| ONNX Runtime Web vs Python (probabilities) | within 1e-4, same top-1 (`web/src/ai/model.parity.test.ts`) |

**Limits.** Other crops' leaves (PlantDoc) are the hardest negatives: about 1 in 4 still passes as rice. Screen photos of
rice are accepted, but the **disease model itself drops to macro-F1 ≈ 0.65 on simulated screen photos** (0.89 on normal photos);
inference-time fixes (blur, flip TTA, gray-world) did not help. A screen-recapture fine-tune was evaluated (Kaggle `agroleaf-screen-finetune` v5): screen-photo macro-F1 0.804, but clean internal test 0.888, below our 0.890 ship rule, so it was **not shipped** (`docs/DECISIONS.md` D17).
