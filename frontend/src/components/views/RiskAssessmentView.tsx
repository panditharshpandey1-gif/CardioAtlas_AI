import React, { useState, useEffect } from 'react';
import { 
  PatientData, 
  PredictionResult, 
  PatientProfile, 
  NavigationTab,
  RiskTier 
} from '../../types/cardio';
import { apiService, FALLBACK_SAMPLE_PATIENTS } from '../../services/api';
import {
  Button,
  Field,
  NumberInput,
  Select,
  SegmentedControl,
  Panel,
  PageHeader,
  Tag,
  Skeleton,
  EmptyState,
  ErrorState,
  ResultBlock,
} from '../ui';
import { ChevronDown } from 'lucide-react';

interface RiskAssessmentViewProps {
  currentPatient: PatientProfile | null;
  prediction: PredictionResult | null;
  onUpdatePatient: (updatedPatient: PatientProfile) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onSaveToHistory: (record: {
    patientId: string;
    patientName: string;
    patientData: PatientData;
    riskScore: number;
    riskTier: RiskTier;
    confidenceInterval?: [number, number];
    topRiskDriver: string;
    clinicalNotes: string;
    isDemo?: boolean;
  }) => void;
}

export function RiskAssessmentView({
  currentPatient,
  prediction,
  onUpdatePatient,
  onSaveToHistory,
}: RiskAssessmentViewProps) {
  const [patientName, setPatientName] = useState<string>(
    currentPatient ? currentPatient.name : 'Held-out test case'
  );
  const [formData, setFormData] = useState<PatientData>(
    currentPatient ? { ...currentPatient.data } : { ...FALLBACK_SAMPLE_PATIENTS[0].data }
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [calculatedResult, setCalculatedResult] = useState<PredictionResult | null>(prediction);

  // Sync with currentPatient when changed from context bar
  useEffect(() => {
    if (currentPatient) {
      queueMicrotask(() => {
        setFormData({ ...currentPatient.data });
        setPatientName(currentPatient.name);
        setFormErrors({});
        setError(null);
      });
    }
  }, [currentPatient]);

  useEffect(() => {
    if (prediction) {
      queueMicrotask(() => {
        setCalculatedResult(prediction);
      });
    }
  }, [prediction]);

  const validateField = (key: keyof PatientData, value: number): string | null => {
    switch (key) {
      case 'age':
        if (value < 18 || value > 100) return 'Age must be between 18 and 100 years';
        break;
      case 'trestbps':
        if (value < 80 || value > 220) return 'Blood pressure must be between 80 and 220 mmHg';
        break;
      case 'chol':
        if (value < 100 || value > 600) return 'Cholesterol must be between 100 and 600 mg/dL';
        break;
      case 'thalach':
        if (value < 60 || value > 220) return 'Max heart rate must be between 60 and 220 bpm';
        break;
      case 'oldpeak':
        if (value < 0 || value > 8) return 'ST depression must be between 0.0 and 8.0 mm';
        break;
      case 'ca':
        if (value < 0 || value > 3) return 'Major vessels must be between 0 and 3';
        break;
    }
    return null;
  };

  const handleFieldChange = (key: keyof PatientData, value: number) => {
    const fieldError = validateField(key, value);
    setFormErrors((prev) => ({
      ...prev,
      [key]: fieldError || '',
    }));
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleCalculate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validate all numeric fields
    const errors: Record<string, string> = {};
    (['age', 'trestbps', 'chol', 'thalach', 'oldpeak', 'ca'] as const).forEach((key) => {
      const err = validateField(key, formData[key]);
      if (err) errors[key] = err;
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const pred = await apiService.predict(formData);
      setCalculatedResult(pred);

      const updatedProfile: PatientProfile = {
        id: currentPatient?.id || `PT-${Math.floor(1000 + Math.random() * 9000)}`,
        name: patientName,
        age: formData.age,
        sex: formData.sex,
        profile_type: `${pred.risk_tier} Risk Assessment`,
        clinical_summary: `${formData.age}yo ${formData.sex === 1 ? 'male' : 'female'}, BP ${formData.trestbps} mmHg, Chol ${formData.chol} mg/dL, Max HR ${formData.thalach} bpm.`,
        data: formData,
        isDemo: currentPatient?.isDemo ?? false,
      };

      onUpdatePatient(updatedProfile);

      onSaveToHistory({
        patientId: updatedProfile.id,
        patientName: updatedProfile.name,
        patientData: formData,
        riskScore: pred.risk_score,
        riskTier: pred.risk_tier,
        confidenceInterval: pred.confidence_interval,
        topRiskDriver:
          formData.trestbps > 140
            ? 'Resting blood pressure'
            : formData.chol > 240
            ? 'Serum cholesterol'
            : 'ST depression',
        clinicalNotes: pred.clinical_recommendation,
        isDemo: updatedProfile.isDemo,
      });
    } catch (err) {
      console.error('Assessment calculation failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to compute risk score. Please check backend status.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    const baseData = currentPatient ? { ...currentPatient.data } : { ...FALLBACK_SAMPLE_PATIENTS[0].data };
    setFormData(baseData);
    setPatientName(currentPatient ? currentPatient.name : 'Held-out test case');
    setCalculatedResult(prediction);
    setFormErrors({});
    setError(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header (24px gap before content) */}
      <PageHeader
        title="Risk Assessment Intake"
        context="Enter or calibrate 13 clinical biomarkers for multi-model ensemble score"
      />

      {/* 2-column layout: Form (8 cols), Sticky Result Panel (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Collapsible Sections Intake Form */}
        <div className="lg:col-span-8">
          <form onSubmit={handleCalculate} className="space-y-4">
            
            {/* Section 1: Demographics (Default OPEN) */}
            <details open className="border border-border rounded bg-surface overflow-hidden group">
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-alt/60 transition-colors select-none">
                <span className="text-emphasis font-semibold text-text">Demographics</span>
                <div className="flex items-center gap-2">
                  <Tag variant="default">3 of 3 entered</Tag>
                  <ChevronDown className="w-4 h-4 text-text-tertiary transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="p-4 pt-1 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field
                    label="Patient Identifier / Name"
                    hint="Case label or clinical ID"
                  >
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="h-8 w-full px-3 rounded-sm border border-border-strong bg-surface text-body text-text-primary transition-colors placeholder:text-text-tertiary hover:border-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      placeholder="e.g. Test case 1"
                    />
                  </Field>

                  <Field
                    label="Age"
                    hint="Valid range: 18–100 years"
                    error={formErrors.age}
                    htmlFor="field-age"
                  >
                    <NumberInput
                      id="field-age"
                      min={18}
                      max={100}
                      value={formData.age}
                      onChange={(e) => handleFieldChange('age', Number(e.target.value))}
                      unit="years"
                    />
                  </Field>

                  <Field label="Sex" error={formErrors.sex}>
                    <SegmentedControl
                      options={[
                        { value: '0', label: 'Female' },
                        { value: '1', label: 'Male' },
                      ]}
                      value={String(formData.sex)}
                      onChange={(val) => handleFieldChange('sex', Number(val))}
                    />
                  </Field>
                </div>
              </div>
            </details>

            {/* Section 2: Symptoms */}
            <details open className="border border-border rounded bg-surface overflow-hidden group">
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-alt/60 transition-colors select-none">
                <span className="text-emphasis font-semibold text-text">Symptoms</span>
                <div className="flex items-center gap-2">
                  <Tag variant="default">2 of 2 entered</Tag>
                  <ChevronDown className="w-4 h-4 text-text-tertiary transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="p-4 pt-1 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Chest pain type (cp)"
                    hint="Select symptomatic presentation"
                    error={formErrors.cp}
                  >
                    <Select
                      value={formData.cp}
                      onChange={(e) => handleFieldChange('cp', Number(e.target.value))}
                      options={[
                        { value: 0, label: '0: Typical angina' },
                        { value: 1, label: '1: Atypical angina' },
                        { value: 2, label: '2: Non-anginal pain' },
                        { value: 3, label: '3: Asymptomatic' },
                      ]}
                    />
                  </Field>

                  <Field
                    label="Exercise-induced angina (exang)"
                    hint="Angina provoked during exercise test"
                    error={formErrors.exang}
                  >
                    <SegmentedControl
                      options={[
                        { value: '0', label: 'No' },
                        { value: '1', label: 'Yes' },
                      ]}
                      value={String(formData.exang)}
                      onChange={(val) => handleFieldChange('exang', Number(val))}
                    />
                  </Field>
                </div>
              </div>
            </details>

            {/* Section 3: Resting measurements */}
            <details open className="border border-border rounded bg-surface overflow-hidden group">
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-alt/60 transition-colors select-none">
                <span className="text-emphasis font-semibold text-text">Resting measurements</span>
                <div className="flex items-center gap-2">
                  <Tag variant="default">4 of 4 entered</Tag>
                  <ChevronDown className="w-4 h-4 text-text-tertiary transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="p-4 pt-1 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Resting blood pressure (trestbps)"
                    hint="Valid range: 80–220 mmHg"
                    error={formErrors.trestbps}
                    htmlFor="field-trestbps"
                  >
                    <NumberInput
                      id="field-trestbps"
                      min={80}
                      max={220}
                      value={formData.trestbps}
                      onChange={(e) => handleFieldChange('trestbps', Number(e.target.value))}
                      unit="mmHg"
                    />
                  </Field>

                  <Field
                    label="Serum cholesterol (chol)"
                    hint="Valid range: 100–600 mg/dL"
                    error={formErrors.chol}
                    htmlFor="field-chol"
                  >
                    <NumberInput
                      id="field-chol"
                      min={100}
                      max={600}
                      value={formData.chol}
                      onChange={(e) => handleFieldChange('chol', Number(e.target.value))}
                      unit="mg/dL"
                    />
                  </Field>

                  <Field
                    label="Fasting blood sugar > 120 mg/dL (fbs)"
                    hint="Metabolic glycemic status"
                    error={formErrors.fbs}
                  >
                    <SegmentedControl
                      options={[
                        { value: '0', label: 'No (≤120)' },
                        { value: '1', label: 'Yes (>120)' },
                      ]}
                      value={String(formData.fbs)}
                      onChange={(val) => handleFieldChange('fbs', Number(val))}
                    />
                  </Field>

                  <Field
                    label="Resting electrocardiogram (restecg)"
                    hint="Baseline resting ECG status"
                    error={formErrors.restecg}
                  >
                    <Select
                      value={formData.restecg}
                      onChange={(e) => handleFieldChange('restecg', Number(e.target.value))}
                      options={[
                        { value: 0, label: '0: Normal' },
                        { value: 1, label: '1: ST-T abnormality' },
                        { value: 2, label: '2: LV hypertrophy' },
                      ]}
                    />
                  </Field>
                </div>
              </div>
            </details>

            {/* Section 4: Exercise test */}
            <details open className="border border-border rounded bg-surface overflow-hidden group">
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-alt/60 transition-colors select-none">
                <span className="text-emphasis font-semibold text-text">Exercise test</span>
                <div className="flex items-center gap-2">
                  <Tag variant="default">3 of 3 entered</Tag>
                  <ChevronDown className="w-4 h-4 text-text-tertiary transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="p-4 pt-1 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field
                    label="Max heart rate (thalach)"
                    hint="Valid range: 60–220 bpm"
                    error={formErrors.thalach}
                    htmlFor="field-thalach"
                  >
                    <NumberInput
                      id="field-thalach"
                      min={60}
                      max={220}
                      value={formData.thalach}
                      onChange={(e) => handleFieldChange('thalach', Number(e.target.value))}
                      unit="bpm"
                    />
                  </Field>

                  <Field
                    label="ST depression (oldpeak)"
                    hint="Valid range: 0.0–8.0 mm"
                    error={formErrors.oldpeak}
                    htmlFor="field-oldpeak"
                  >
                    <NumberInput
                      id="field-oldpeak"
                      min={0}
                      max={8}
                      step={0.1}
                      value={formData.oldpeak}
                      onChange={(e) => handleFieldChange('oldpeak', Number(e.target.value))}
                      unit="mm"
                    />
                  </Field>

                  <Field
                    label="Slope of ST segment (slope)"
                    hint="Peak exercise ST slope"
                    error={formErrors.slope}
                  >
                    <Select
                      value={formData.slope}
                      onChange={(e) => handleFieldChange('slope', Number(e.target.value))}
                      options={[
                        { value: 0, label: '0: Upsloping' },
                        { value: 1, label: '1: Flat' },
                        { value: 2, label: '2: Downsloping' },
                      ]}
                    />
                  </Field>
                </div>
              </div>
            </details>

            {/* Section 5: Other findings */}
            <details open className="border border-border rounded bg-surface overflow-hidden group">
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-alt/60 transition-colors select-none">
                <span className="text-emphasis font-semibold text-text">Other findings</span>
                <div className="flex items-center gap-2">
                  <Tag variant="default">2 of 2 entered</Tag>
                  <ChevronDown className="w-4 h-4 text-text-tertiary transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="p-4 pt-1 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Major vessels colored (ca)"
                    hint="Fluoroscopy count (0–3)"
                    error={formErrors.ca}
                  >
                    <SegmentedControl
                      options={[
                        { value: '0', label: '0' },
                        { value: '1', label: '1' },
                        { value: '2', label: '2' },
                        { value: '3', label: '3' },
                      ]}
                      value={String(formData.ca)}
                      onChange={(val) => handleFieldChange('ca', Number(val))}
                    />
                  </Field>

                  <Field
                    label="Thalassemia defect (thal)"
                    hint="Nuclear scintigraphy perfusion"
                    error={formErrors.thal}
                  >
                    <Select
                      value={formData.thal}
                      onChange={(e) => handleFieldChange('thal', Number(e.target.value))}
                      options={[
                        { value: 1, label: '1: Normal perfusion' },
                        { value: 2, label: '2: Fixed defect' },
                        { value: 3, label: '3: Reversible defect' },
                      ]}
                    />
                  </Field>
                </div>
              </div>
            </details>

            {/* Explicit Action Buttons */}
            <div className="flex items-center gap-3 pt-3">
              <Button variant="primary" type="submit" disabled={isLoading}>
                {isLoading ? 'Calculating score...' : 'Calculate model score'}
              </Button>
              <Button variant="secondary" type="button" onClick={handleReset} disabled={isLoading}>
                Reset to defaults
              </Button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: Sticky Result Panel (4 cols) */}
        <div className="lg:col-span-4 sticky top-4 space-y-4">
          {isLoading ? (
            <Panel className="p-4 space-y-3">
              <div className="text-caption text-text-2 font-medium">
                Computing ensemble score...
              </div>
              <Skeleton rows={7} />
            </Panel>
          ) : error ? (
            <ErrorState
              title="Calculation failed"
              message={error}
              onRetry={handleCalculate}
            />
          ) : calculatedResult ? (
            <ResultBlock
              score={calculatedResult.risk_score}
              tier={calculatedResult.risk_tier}
              models={calculatedResult.model_breakdown}
              disclaimer={calculatedResult.disclaimer}
            />
          ) : (
            <Panel className="p-6">
              <EmptyState
                title="No calculation yet"
                description="Review intake biomarkers and click Calculate."
              />
            </Panel>
          )}
        </div>

      </div>
    </div>
  );
}

export default RiskAssessmentView;
