# Cardio Atlas AI — Full Redesign Notes

### Architecture retained

React + TypeScript + Vite frontend, FastAPI + trained ensemble backend, R3F/Three.js 3D assets. The existing backend inference and training pipeline were **not altered**. Exported CSV uses the original existing Cleveland file and includes explicit attribution.

### Fully rebuilt visual architecture

`src/components/views/EntryPageView.tsx`: complete landing replacement, interactive anatomy hero, features, pipeline, selectable case samples.

`src/components/layout/{NavRail,ContextBar,AppShell}.tsx`: complete navigation/workspace replacement with mobile navigation and search-able case selector.

`src/components/views/OverviewView.tsx`: entirely new interactive risk-and-anatomy analytics dashboard; only shows actual backend scores, not guessed percentages.

`src/components/views/HeartExplorerView.tsx`: entirely new anatomical workbench and 5-region navigation, retaining all existing 3D viewer functions.

`src/components/views/DatasetLibraryView.tsx`: new research data library with direct local CSV downloads, metadata, and dictionary.

`src/index.css` + `src/premium.css`: replaced design tokens and full visual presentation, including remaining functional pages and responsive breakpoints.

`src/App.tsx`, `src/types/cardio.ts`: added Dataset Library route without removing existing routes.

### Source research

UCI Machine Learning Repository: https://archive.ics.uci.edu/dataset/45/heart+disease
DOI: https://doi.org/10.24432/C52P4X
License: CC BY 4.0.

### Checks

TypeScript passed; 18 backend dataset/API tests passed; stylesheet parsed with zero errors. Production bundle and live browser screenshot not certified because the included frontend dependencies were Windows binaries and no registry access was available in the build environment. Run `npm install` on Windows before `npm run build`.
