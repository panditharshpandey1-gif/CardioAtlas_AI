# Cardio Atlas AI — Full UI Rebuild

An immersive cardiovascular research workstation, redesigned from the supplied CardioVision prototype. **Not a medical device.** Results are experimental heart-disease classification outputs from a historical dataset, not an estimate of future event probability or a clinical recommendation.

## Launch on Windows (VS Code)

1. Extract this ZIP into a regular project directory (e.g. `Documents/cardio-atlas`).
2. Open the extracted project folder (the one containing `run.py`) in VS Code.
3. Open a PowerShell terminal and run:

```powershell
python -m pip install -r backend/requirements.txt
npm install
python run.py
```

Open the frontend URL printed by the launcher (typically `http://127.0.0.1:5173`).

If Python is only available as `py`, use `py -m pip ...` then `py run.py`. To run the frontend alone, `cd frontend; npm install; npm run dev`. To produce a distributable frontend build, run `npm run build` in `frontend` after installing node dependencies for your system.

**Important:** Do not copy the old project's `node_modules` folder into the newly extracted project. Install modules fresh for your operating system; Vite 8 / Rolldown uses platform-specific binaries. Requires a current Node.js release compatible with Vite 8 and a Python environment that satisfies `backend/requirements.txt`.

## What's new

A complete replacement design system has been introduced, not a few isolated card changes:

- New **Cardio Atlas** product language, typography, colors, gradients, spacing, responsive rules, motion and components.
- New cinematic landing page with an actual interactive anatomical 3D heart and prominent app entry points.
- Entirely new responsive application shell, navigation rail, case selector and API-status indicator.
- Rebuilt overview: a truthful score dial, 3D visual, biomarker dashboard, model breakdown, attribution ranking and module links.
- Rebuilt 3D anatomical explorer layout, five-region navigation and detailed inspector, retaining 3D X-ray controls and rotation.
- Dedicated **Dataset Library**, with two working, local static CSV download links, a searchable data dictionary and research provenance.
- Risk intake, scenario lab, explainability charts, history reports, and model validation pages all share the new design tokens, dark panels, styled tables, modern inputs, tab controls and responsive layouts. Their existing analysis behavior was preserved.

## Dataset: real UCI Heart Disease / Cleveland cohort

Data source: https://archive.ics.uci.edu/dataset/45/heart+disease  
DOI: https://doi.org/10.24432/C52P4X  
License: **Creative Commons Attribution 4.0 (CC BY 4.0)**  
Creators: Andras Janosi, William Steinbrunn, Matthias Pfisterer, Robert Detrano.  
Historical dataset: 303 records, 13 input features, original disease target `num` in 0–4.

The Dataset Library page provides **direct browser downloads even when the API server is offline**, because files live in `frontend/public/datasets/`.

| File | Purpose |
| --- | --- |
| `frontend/public/datasets/uci_cleveland_original.csv` | 303 source records with UCI Cleveland's ORIGINAL encodings and original 0–4 target; the `?` marker is preserved. |
| `frontend/public/datasets/cardiovision_model_ready.csv` | The same 303 rows with app-compatible `cp` (`-1`), `slope` (`-1`) and `thal` (3→1, 6→2, 7→3) encodings, a **binary** `target_binary`, and original missing fields kept blank. |
| `frontend/public/datasets/DATASET_CITATION.json` | Attribution, usage and license notes. |
| `backend/data/processed.cleveland.data` | Original data used by the existing backend. |
| `backend/data/PROVENANCE.md` | Full source/coding and training pre-processing specification. |

The downloadable model-ready file is a **transformed export, not a newly collected dataset**. No new model was trained as part of this visual redesign. Backend evaluation and model artifacts are inherited from the supplied prototype. Do not treat the demo as clinically validated.

## Feature directory

- Home: interactive immersive landing.
- Overview: research score and biomarker intelligence.
- Risk assessment: thirteen-variable intake, validation, prediction API, save history.
- Anatomy explorer: anatomical model with tissue/vascular/hologram/X-ray-inspired views, opacity and region inspector.
- Scenario lab: baseline vs. modified feature experiments.
- AI explainability: contribution plots and feature impacts.
- Case history: saved session browsing and PDF print/JSON export.
- Model intelligence: transparency dossier with dataset and evaluation metrics.
- Dataset library: source downloads and searchable data dictionary.

## Track A patient-synced heart + model explanation upgrade (October 2026)

- Patient-selected, input-linked illustrative 3D clinical-signal markers. The model is **not** a CT/MRI reconstruction or a blockage localizer.
- What-if scenario inputs synchronously update the 3D heart markers, with recalculated backend ensemble outputs. Example scenarios are **not treatment recommendations**.
- Genuine TreeSHAP endpoint for the **un-calibrated Gradient Boosting model component**, in log-odds. This is not a SHAP explanation of the combined calibrated ensemble.
- Inline ROC and reliability plots on the Model Intelligence page, true 61-case holdout confusion matrix, published bootstrap metric intervals, and 82.6% cross-validation as the primary headline.
- Reproducible out-of-site evaluation script `python backend/external_validation.py --download` for Hungarian, Swiss and VA Long Beach original data. **Not yet run successfully; no external-validation results claimed.**
- See `TRACK_A_RELEASE_NOTES.md` for exact status, verification and references.

## Verification notes

- TypeScript compilation: **passed** using the installed TypeScript tool.
- Backend API and dataset tests: **38 passed** (including TreeSHAP and model prediction regression tests).
- CSS parse: **no syntax errors**.
- Full Vite production build could not run in the Linux assembly environment because the pre-existing `node_modules` contained Windows-only native binary dependencies and package-registry access was unavailable. For Windows, run `npm install` locally as described above. A browser-level rendering test of the complete built Vite app was therefore not certified in this environment.

## Research caution

The UCI Cleveland data is small, historical, and not representative of all modern patient populations. The displayed scores are dataset classification scores, **not 10-year cardiovascular risk estimates**, anatomical patient scans or medical advice. Inputs resembling interventions in the what-if module are counterfactual model-input demonstrations rather than treatment recommendations.
