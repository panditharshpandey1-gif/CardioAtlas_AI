# Deploy Cardio Atlas AI on Render (single public URL)

This repository includes a multi-stage `Dockerfile`, `render.yaml`, and a production ASGI entrypoint, `deploy_app.py`.
Render builds the React/Vite frontend in a Node 24 stage, installs the FastAPI/ML runtime in Python 3.13, then serves the entire UI and backend under **one HTTPS URL**. No separate frontend URL, CORS configuration, or environment-variable URL replacement is needed.

## 1. Put the extracted `CardioAtlas_AI` contents on GitHub

Create an empty GitHub repository (for example `cardio-atlas-ai`), then open a terminal **inside the `CardioAtlas_AI` directory containing `Dockerfile` and `render.yaml`**:

```powershell
git init
git add .
git commit -m "Prepare Cardio Atlas AI production deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/cardio-atlas-ai.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username. You need to sign in to GitHub; Git Credential Manager may prompt. If `git commit` asks for your identity, configure Git's `user.name` and `user.email`. **Do not accidentally upload node_modules, .env files, patient details, or secrets.** The bundled Cleveland cohort is a research dataset, not your own patient data. The 38 MB GLB may exceed GitHub's browser upload per-file limit, so use `git push`/GitHub Desktop, not GitHub's web file uploader.

## 2. Create a Render Blueprint

1. Visit https://dashboard.render.com/ and connect your GitHub account.
2. Select **New → Blueprint**.
3. Pick your `cardio-atlas-ai` GitHub repository.
4. The `render.yaml` should be detected automatically. Approve the proposed **Web Service** (Docker). The blueprint currently selects the **Free** instance.
5. Deploy. Render will build the frontend, install the ML dependencies, then start the app at the URL it assigns. **Do not guess the URL; copy it from your Render dashboard.**

Or create **New → Web Service** manually, select your repo, use **Language = Docker**, Dockerfile path `./Dockerfile`, **Root Directory = repo root**, and health check path `/api/health`. The Dockerfile itself supplies the start command.

## 3. Verify your LIVE site

Open the exact Render URL from your dashboard, then check:

- `/` — actual Cardio Atlas landing page (not backend JSON)
- `/api/health` — returns status `healthy`, dataset/model readiness
- `/docs` — Swagger FastAPI documentation
- `/datasets/uci_cleveland_original.csv` — downloadable dataset
- `/models/realistic_human_heart.glb` — 3D heart asset
- In the UI: open **3D Heart Explorer** and select a patient; check What-If Lab and SHAP explanation

A fresh free-instance startup can be slow because Render pauses inactive services; **wake the service before a live hackathon demo**. The free tier has 512 MB RAM; the Python ML stack could exceed it under load, in which case select a paid 2 GB instance. Monitor Render Logs and Metrics for memory or startup failures. Free hosting is for demos, not clinical production.

## Troubleshooting

- **Build fails during npm install:** ensure `frontend/package-lock.json` is present, Node 24 is used, and no Windows `node_modules` has been committed.
- **Backend health is 503:** inspect startup logs; ensure the bundled `backend/data/model_artifacts.joblib` and `backend/data/processed.cleveland.data` are present. `scikit-learn==1.9.1` is required to match the saved model artifacts.
- **Model memory usage is too high:** upgrade the Render instance, avoid multiple Uvicorn workers, or optimize the model/explanation stack. Do not disguise memory errors by reporting fake results.
- **Site shows backend JSON:** verify the deployed startup command is `uvicorn deploy_app:app ...`, not `uvicorn backend.main:app ...`.
- **3D model doesn't appear:** check browser network requests for `/models/realistic_human_heart.glb` and `/models/Human_Heart_Interior_View.glb`.
- **API works but site is blank:** check Browser Console and confirm Docker frontend build succeeded (`npm run build`).

## Privacy and research limits

Do not enter real identifiable patient details on a public demo deployment. The application is a research/education prototype, not a clinical tool. Heart overlays are illustrative model-associated indicators, not scans or diagnosed lesions. The current history does not constitute a secure, persistent patient database.
