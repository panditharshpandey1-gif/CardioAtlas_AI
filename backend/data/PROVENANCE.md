# UCI Heart Disease Dataset — Provenance and Citation

## Source Details
- **Dataset Name**: Heart Disease (Cleveland Database)
- **Repository URL**: https://archive.ics.uci.edu/dataset/45/heart+disease
- **Raw Data URL**: https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Creators / Principal Investigators**:
  1. Hungarian Institute of Cardiology. Budapest: Andras Janosi, M.D.
  2. University Hospital, Zurich, Switzerland: William Steinbrunn, M.D.
  3. University Hospital, Basel, Switzerland: Matthias Pfisterer, M.D.
  4. V.A. Medical Center, Long Beach and Cleveland Clinic Foundation: Robert Detrano, M.D., Ph.D.
- **Donor**: David Aha (1988)

## Verified Primary Citation
> Detrano, R., Janosi, A., Steinbrunn, W., Pfisterer, M., Schmid, J. J., Sandhu, S., Gopalakrishna, P. X., Belle, V. (1989). International application of a new probability algorithm for the diagnosis of coronary artery disease. *American Journal of Cardiology*, 64(5), 304–310. https://doi.org/10.1016/0002-9149(89)90524-9

## Dataset Characteristics
- **Total Records**: 303 rows
- **Total Features**: 13 predictive features + 1 target (`num`)
- **Missing Values**: Represented by `?`
  - `ca`: 4 missing values
  - `thal`: 2 missing values
- **Target Variable (`num`)**:
  - `0`: No presence of heart disease (< 50% diameter narrowing in major vessel)
  - `1, 2, 3, 4`: Presence of heart disease (>= 50% diameter narrowing)
  - Binary target converted as: `num > 0 -> 1` else `0`.

## Feature Encoding & Conversions for CardioVision AI
| Feature | UCI Raw Encoding | App Encoding | Conversion Logic |
|---|---|---|---|
| `age` | Age in years | Age in years | Identity |
| `sex` | 1 = male, 0 = female | 1 = male, 0 = female | Identity |
| `cp` (chest pain) | 1: typical angina, 2: atypical angina, 3: non-anginal pain, 4: asymptomatic | 0: typical angina, 1: atypical angina, 2: non-anginal, 3: asymptomatic | Subtract 1 (`cp - 1`) |
| `trestbps` | Resting blood pressure (mm Hg) | Resting blood pressure (mm Hg) | Identity |
| `chol` | Serum cholesterol (mg/dl) | Serum cholesterol (mg/dl) | Identity |
| `fbs` | 1 = > 120 mg/dl, 0 = <= 120 mg/dl | 1 = > 120 mg/dl, 0 = <= 120 mg/dl | Identity |
| `restecg` | 0: normal, 1: ST-T wave abnormality, 2: left ventricular hypertrophy | 0: normal, 1: ST-T abnormality, 2: LV hypertrophy | Identity |
| `thalach` | Maximum heart rate achieved | Maximum heart rate achieved | Identity |
| `exang` | 1 = yes, 0 = no | 1 = yes, 0 = no | Identity |
| `oldpeak` | ST depression induced by exercise relative to rest | ST depression (float) | Identity |
| `slope` | 1: upsloping, 2: flat, 3: downsloping | 0: upsloping, 1: flat, 2: downsloping | Subtract 1 (`slope - 1`) |
| `ca` | 0–3: number of major vessels colored by flourosopy | 0–3 | Identity; missing imputed inside pipeline |
| `thal` | 3: normal, 6: fixed defect, 7: reversible defect | 1: normal, 2: fixed defect, 3: reversible defect | Map `{3: 1, 6: 2, 7: 3}`; missing imputed inside pipeline |
| `num` (target) | 0 (no disease), 1-4 (disease) | 0: absent, 1: present | `1 if num > 0 else 0` |
