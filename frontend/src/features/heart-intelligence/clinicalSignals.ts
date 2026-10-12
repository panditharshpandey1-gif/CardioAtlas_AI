import type { PatientData, ShapExplanation } from '../../types/cardio';

export type ClinicalSignalId = 'blood-pressure' | 'cholesterol' | 'exercise-angina' | 'st-depression' | 'ecg' | 'glucose-flag' | 'fluoroscopy' | 'thalassemia' | 'chest-pain';

export interface ClinicalSignal {
  id: ClinicalSignalId;
  label: string;
  shortLabel: string;
  reading: string;
  flagged: boolean;
  note: string;
  trigger: string;
  isPositiveModelInfluence: boolean;
  influenceMagnitude: number | null;
  position: [number, number, number];
}

/*
 * The display rules below only spotlight tabular attributes. They are NOT an
 * anatomy mapping, lesion localization, clinical risk stratification, or
 * validated diagnostic rules. The actual model score comes exclusively from
 * /api/predict. Feature influences come exclusively from /api/explain.
 */
export function buildClinicalSignals(data: PatientData, explanation: ShapExplanation | null): ClinicalSignal[] {
  const contributions = new Map((explanation?.feature_contributions ?? []).map(c => [c.feature, c]));
  const prominentDrivers = new Set((explanation?.top_risk_drivers ?? []).slice(0, 3).map(c => c.feature));
  const makeSignal = (
    id: ClinicalSignalId, label: string, shortLabel: string, reading: string,
    flagged: boolean, note: string, trigger: string,
    feature: keyof PatientData, position: [number, number, number],
  ): ClinicalSignal => {
    const contribution = contributions.get(feature);
    return {
      id, label, shortLabel, reading, flagged: flagged || prominentDrivers.has(feature), note, trigger, position,
      isPositiveModelInfluence: Boolean(contribution?.direction === 'increases_risk'),
      influenceMagnitude: contribution ? Math.abs(contribution.contribution) : null,
    };
  };
  return [
    makeSignal('blood-pressure', 'Resting blood pressure', 'BP', `${data.trestbps} mmHg`,
      data.trestbps >= 140, 'Resting systolic pressure in this dataset. A value-based spotlight is not proof of cardiac damage.',
      'Visual spotlight when systolic BP ≥ 140 mmHg (illustrative threshold).', 'trestbps', [-1.28, .62, .48]),
    makeSignal('cholesterol', 'Serum cholesterol', 'CHOL', `${data.chol} mg/dL`,
      data.chol >= 240, 'A serum cholesterol value; the 3D display cannot reveal plaque or a blocked artery.',
      'Visual spotlight when total cholesterol ≥ 240 mg/dL.', 'chol', [1.25, .76, .35]),
    makeSignal('exercise-angina', 'Exercise-induced angina', 'ANGINA', data.exang === 1 ? 'Reported' : 'Not reported',
      data.exang === 1, 'Dataset flag indicating whether exercise-related angina was reported. It does not localize a coronary lesion.',
      'Spotlight when dataset flag = 1.', 'exang', [1.34, -.06, .48]),
    makeSignal('st-depression', 'Exercise-related ST depression', 'ST', `${data.oldpeak} mm`,
      data.oldpeak >= 2, 'Oldpeak is a dataset measurement. This viewer cannot recreate a clinical ECG tracing.',
      'Visual spotlight when oldpeak ≥ 2 (illustrative cutoff, not a diagnosis).', 'oldpeak', [-1.32, -.18, .45]),
    makeSignal('ecg', 'Resting ECG category', 'ECG', data.restecg === 0 ? 'Code 0' : `Code ${data.restecg}`,
      data.restecg !== 0, 'A categorical feature from the UCI record; this is not a live or reconstructed ECG.',
      'Spotlight when dataset category is non-zero.', 'restecg', [1.12, -.84, .28]),
    makeSignal('fluoroscopy', 'Number of fluoroscopy vessels', 'CA', `Code ${data.ca} / 3`,
      data.ca >= 2, 'Dataset vessel count feature. A numeric code cannot locate an arterial obstruction in this 3D heart.',
      'Spotlight when vessel count ≥ 2, or when a top positive model driver.', 'ca', [-1.45, 0.20, .27]),
    makeSignal('thalassemia', 'Thal test category', 'THAL', `Code ${data.thal}`,
      data.thal === 3, 'Historical UCI thal test category, not an anatomical thalassemia diagnosis or heart scan.',
      'Spotlight for code 3, or a top positive model driver.', 'thal', [1.46, .25, .24]),
    makeSignal('chest-pain', 'Chest pain category', 'CP', `Code ${data.cp}`,
      data.cp === 3, 'Historical chest pain category as encoded by the UCI dataset. Does not locate an injury.',
      'Spotlight for code 3, or a top positive model driver.', 'cp', [.01, -1.26, .46]),
    makeSignal('glucose-flag', 'Fasting glucose flag', 'FBS', data.fbs === 1 ? '>120 flag' : 'No >120 flag',
      data.fbs === 1, 'Dataset binary flag for fasting blood sugar above 120 mg/dL; not a glucose measurement.',
      'Spotlight when fasting blood sugar flag = 1.', 'fbs', [-1.13, -.90, .28]),
  ];
}
