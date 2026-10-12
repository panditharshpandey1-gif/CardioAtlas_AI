# Cardio Atlas AI — Track A / October 2026 release

## What's in this release

- `CardioAtlas_AI/` — complete full-stack prototype (React / TypeScript / Three.js frontend, FastAPI backend, trained model artifact, dataset exports and tests). The extracted project includes `run.py`.
- `CardioAtlas_AI_TrackA_9_Slide_Hackathon_Pitch.pptx` — 9-slide editable, revised hackathon PPT with speaker notes, model evidence, links and an embedded illustrative animated 3D GIF.
- `CardioAtlas_AI_TrackA_9_Slide_Hackathon_Pitch.pdf` — nonanimated PDF version for quick review.
- `CardioAtlas_AI_9_Slide_Preview.png` — nine-slide contact sheet.
- `CardioAtlas_20s_3D_Demo_Concept.gif` — 20-second **illustrative 3D visualization concept**, made from the project's own anatomical heart GLB and numerical demo cases. It is **not** a recording of the actual browser app.

## Important fixes implemented

1. Patient-linked 3D heart signal overlays using actual patient data and top attribution features: BP, cholesterol, exercise angina, ECG, ST depression and other Cleveland features. 3D labels are interface callouts rather than coronary lesion localization; rotating, zooming and existing X-ray-inspired views remain available.
2. Live 3D heart reacts to what-if input changes; React sends changed scenarios to the FastAPI what-if endpoint and synchronizes returned ensemble score. Presets renamed to hypothetical scenarios, not treatments.
3. True TreeSHAP `POST /api/feature-shap` plus user-facing waterfall interpretation. **Scope: raw Gradient Boosting component, not the whole calibrated ensemble**, and log-odds units.
4. Model dashboard: five-fold CV headline accuracy **82.6% ± 2.2 percentage points fold SD**, hold-out 61-case accuracy **90.2% (95% bootstrap CI 82.0%–96.7%)**, ROC-AUC **0.959**, specificity **87.9%**, held-out confusion **TN 29, FP 4, FN 2, TP 26**, Brier **0.088**. Check `backend/data/metrics.json` for exact machine-readable values, confidence intervals and ROC points.
5. Real ROC and calibration diagrams from stored trained-model outputs, with limitations and cohort details. The Cleveland dataset has **303 records**, 13 features, 242 train and 61 hold-out test. Original UCI target values 1–4 are mapped to binary presence 1; 0 is absence.
6. External site validation script for UCI Hungarian, Switzerland and VA Long Beach cohorts, written and packaged but **NOT completed**; the required files were unavailable to this environment. `backend/data/external_validation.json` accurately records `not_evaluated`.
7. PPT fixed overlap and text legibility, added previous solutions vs ours, technical workflow, real measured performance and CI, impact/benefits, ethics, source links, speaker notes. Slide 7 marks the GIF as a concept render; it is not falsely described as a live browser recording.

## Windows setup

Requires a supported Python 3 environment, Node.js version compatible with Vite 8, and a working internet connection to install modules.

1. Extract `CardioAtlas_AI/` into a writable local folder; open that folder in VS Code.
2. Run in PowerShell:

   ```powershell
   python -m pip install -r backend/requirements.txt
   npm install
   python run.py
   ```

3. Open the local frontend URL printed in the terminal, usually `http://127.0.0.1:5173`.
4. Select a sample patient; open **3D Heart Explorer** to see the illustrative patient-associated signals. Change patient, then open **What-If Lab** and move BP/cholesterol sliders to see 3D signals update and backend score recalculate.
5. For an offline export of UCI data, open **Dataset Library** inside the app; both source and model-ready CSVs are in `frontend/public/datasets/`.
6. To evaluate additional original UCI processed site files when a connection is available:

   ```powershell
   python backend/external_validation.py --download
   ```

   If the UCI host blocks downloads, manually put `processed.hungarian.data`, `processed.switzerland.data`, and `processed.va.data` in `backend/data/external/` then run `python backend/external_validation.py`.

## Verified and not verified

- PASS: TypeScript project compilation (using installed TypeScript compiler).
- PASS: 38 / 38 FastAPI/backend tests (including genuine SHAP additivity and differing-patient prediction checks).
- PASS: PPT renders as nine slides, with nine sets of speaker notes, embedded demo GIF and clickable references.
- NOT VERIFIED: full Vite production build on this Linux environment due pre-existing platform-incompatible native Rolldown dependency. Fresh `npm install` on Windows is required.
- NOT VERIFIED: browser-level screenshots/GIF of running frontend (browser sandbox blocked local site/file access), so demo GIF is a concept render, **not an actual screen recording**.
- NOT AVAILABLE: verified deployment URL and GitHub/team details; editable placeholders remain on PPT and **no QR code or fake live link** was fabricated.
- NOT COMPLETED: clinical or out-of-site external validation, conformal prediction intervals, whole-ensemble SHAP, patient-specific CT/MRI geometry or actual lesion localization.

## Data, ethics and limitations

This is a research/education prototype classifying disease presence from a small, historical Cleveland cohort. The data are not representative of India's current diverse patient population. Classification probabilities are not future cardiovascular event-risk predictions and must not be used for diagnosis. 3D annotations are generic model-associated **signals**, not patient-specific anatomical damage. What-if sliders describe mathematical input-output sensitivity, not treatment effectiveness.

## References (clickable in slides)

- WHO cardiovascular disease fact sheet: https://www.who.int/news-room/fact-sheets/detail/cardiovascular-diseases-%28cvds%29
- India GBD 2016 cardiovascular mortality study: https://pmc.ncbi.nlm.nih.gov/articles/PMC6227386/
- UCI Heart Disease dataset: https://archive.ics.uci.edu/dataset/45/heart+disease
- SHAP original paper: https://arxiv.org/abs/1705.07874
- AHA 17-segment anatomy (future work only): https://pubmed.ncbi.nlm.nih.gov/11815441/
