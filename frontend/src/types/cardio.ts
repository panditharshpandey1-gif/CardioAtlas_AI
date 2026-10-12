export interface PatientData {
  age: number;
  sex: number; // 1 = Male, 0 = Female
  cp: number; // 0 = Typical angina, 1 = Atypical, 2 = Non-anginal, 3 = Asymptomatic
  trestbps: number; // Resting Blood Pressure (mmHg)
  chol: number; // Serum Cholesterol (mg/dL)
  fbs: number; // Fasting Blood Sugar > 120 (1 = true, 0 = false)
  restecg: number; // Resting ECG (0 = Normal, 1 = ST-T wave abnormality, 2 = LV hypertrophy)
  thalach: number; // Max Heart Rate (bpm)
  exang: number; // Exercise-Induced Angina (1 = yes, 0 = no)
  oldpeak: number; // ST Depression (mm)
  slope: number; // Slope of ST segment (0 = Upsloping, 1 = Flat, 2 = Downsloping)
  ca: number; // Number of major vessels (0-3)
  thal: number; // Thalassemia (1 = Normal, 2 = Fixed defect, 3 = Reversible defect)
}

export type RiskTier = 'Low' | 'Moderate' | 'High' | 'Very high' | 'Critical';

export interface ModelBreakdown {
  ensemble: number;
  gradient_boosting: number;
  random_forest: number;
  logistic_regression: number;
}

export interface PredictionResult {
  risk_score: number;
  risk_tier: RiskTier;
  display_band?: string;
  risk_color?: string;
  clinical_recommendation: string;
  model_breakdown: ModelBreakdown;
  disclaimer: string;
  confidence_interval?: [number, number];
  benchmark_percentile?: number;
}

export interface FeatureContribution {
  feature: string;
  label: string;
  patient_value: number;
  baseline_value: number;
  contribution: number;
  shap_value: number; // retained for UI compatibility
  direction: 'increases_risk' | 'reduces_risk';
  importance_magnitude: number;
}

export interface ShapExplanation {
  base_value: number;
  predicted_value: number;
  total_delta: number;
  feature_contributions: FeatureContribution[];
  top_risk_drivers: FeatureContribution[];
  top_protective_factors: FeatureContribution[];
}

export interface WhatIfResult {
  baseline_score: number;
  baseline_tier: RiskTier;
  simulated_score: number;
  simulated_tier: RiskTier;
  risk_delta: number;
  impact_direction: 'improved' | 'elevated' | 'unchanged';
  clinical_notes: string;
  modified_parameters: Partial<PatientData>;
}

export interface PatientProfile {
  id: string;
  name: string;
  dataset_row?: number;
  clinical_summary: string;
  data: PatientData;
  outcome?: number;
  ensemble_score?: number;
  age?: number;
  sex?: number;
  profile_type?: string;
  isDemo?: boolean;
}

export interface ArteryMetadata {
  id: 'LAD' | 'RCA' | 'LCX';
  name: string;
  nickname: string;
  description: string;
  clinical_impact: string;
  typical_territory: string;
  color_indicator: string;
}

export type NavigationTab = 
  | 'entry'
  | 'overview' 
  | 'assessment'
  | 'prediction' // backward compatibility alias
  | 'heart' 
  | 'whatif' 
  | 'explainability' 
  | 'history'
  | 'model-card'
  | 'datasets'
  | 'ui-test';

export interface MetricWithCI {
  value: number;
  ci_low: number;
  ci_high: number;
}

export interface MetricMeanStd {
  mean: number;
  std: number;
}

export interface CVModelMetric {
  name: string;
  roc_auc: MetricMeanStd;
  pr_auc: MetricMeanStd;
  accuracy?: MetricMeanStd;
  precision?: MetricMeanStd;
  sensitivity?: MetricMeanStd;
  specificity?: MetricMeanStd;
  f1?: MetricMeanStd;
  brier: MetricMeanStd;
}

export interface ConfusionMatrixData {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface TestModelMetric {
  name: string;
  status: 'Primary' | 'Candidate';
  roc_auc: MetricWithCI;
  pr_auc: MetricWithCI;
  accuracy?: MetricWithCI;
  precision?: MetricWithCI;
  sensitivity: MetricWithCI;
  specificity: MetricWithCI;
  f1?: MetricWithCI;
  brier: MetricWithCI;
  confusion_matrix?: ConfusionMatrixData;
}

export interface CalibrationBin {
  mean_predicted: number;
  fraction_positive: number;
  n: number;
}

export interface ModelMetricsResponse {
  dataset: {
    name: string;
    source_url: string;
    n_rows: number;
    n_train: number;
    n_test: number;
    positive_rate: number;
    split: string;
    missing_handling: string;
  };
  threshold: number;
  roc_curve?: {fpr:number;tpr:number}[];
  cv: CVModelMetric[];
  test: TestModelMetric[];
  calibration: {
    method: string;
    bins: CalibrationBin[];
  };
  limitations: string[];
}

export interface HealthResponse {
  status: string;
  ready: boolean;
  dataset: string;
  dataset_present?: boolean;
  artifacts_present?: boolean;
  n_rows: number;
  model_version: string;
}

// Deprecated metric item kept for legacy views during transition
export interface ModelMetricItem {
  name: string;
  roc_auc: number;
  pr_auc: number;
  sensitivity: number;
  specificity: number;
  f1_score?: number;
  status: string;
}

export interface AssessmentHistoryRecord {
  id: string;
  timestamp: string;
  patientId: string;
  patientName: string;
  patientData: PatientData;
  riskScore: number;
  riskTier: RiskTier;
  confidenceInterval?: [number, number];
  topRiskDriver?: string;
  clinicalNotes: string;
  isDemo?: boolean;
}

export interface TreeShapExplanation {
  method: string;
  reference_model: string;
  unit: string;
  base_log_odds: number;
  prediction_log_odds: number;
  prediction_probability: number;
  is_ensemble_explanation: boolean;
  disclaimer: string;
  features: {feature: string;label: string;value: number;shap_log_odds: number}[];
}
