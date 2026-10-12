import React, { useState, useEffect } from 'react';
import { PatientData, WhatIfResult, PatientProfile } from '../../types/cardio';
import { apiService } from '../../services/api';
import { buildClinicalSignals } from '../../features/heart-intelligence/clinicalSignals';
import { HeartViewer3D } from '../heart/HeartViewer3D';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { Tag } from '../ui/Tag';
import { Button } from '../ui/Button';
import { 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Minus,
  Info 
} from 'lucide-react';

interface WhatIfLabViewProps {
  currentPatient: PatientProfile | null;
  onApplyToPatient: (simulatedData: PatientData) => void;
}

export function WhatIfLabView({
  currentPatient,
  onApplyToPatient,
}: WhatIfLabViewProps) {
  const baselineData: PatientData = React.useMemo(() => {
    return currentPatient?.data || {
      age: 55,
      sex: 1,
      cp: 3,
      trestbps: 140,
      chol: 240,
      fbs: 0,
      restecg: 0,
      thalach: 145,
      exang: 0,
      oldpeak: 1.2,
      slope: 1,
      ca: 0,
      thal: 1,
    };
  }, [currentPatient]);

  const [simulatedData, setSimulatedData] = useState<PatientData>(() => ({ ...baselineData }));
  const [simulationResult, setSimulationResult] = useState<WhatIfResult | null>(null);
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState<boolean>(false);

  // Sync when baseline changes
  useEffect(() => {
    queueMicrotask(() => {
      setSimulatedData({ ...baselineData });
      setActivePreset(null);
    });
  }, [baselineData]);

  // Recalculate on biomarker change (debounced with bounds check)
  useEffect(() => {
    let cancelled = false;

    // Guard: only simulate when inputs are within valid clinical model domains
    const isWithinRange = 
      simulatedData.trestbps >= 80 && simulatedData.trestbps <= 220 &&
      simulatedData.chol >= 100 && simulatedData.chol <= 600 &&
      simulatedData.thalach >= 60 && simulatedData.thalach <= 220 &&
      simulatedData.oldpeak >= 0 && simulatedData.oldpeak <= 8.0;

    if (!isWithinRange) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsComputing(true);
      setSimError(null);
      try {
        const res = await apiService.whatIf(baselineData, simulatedData);
        if (!cancelled) {
          setSimulationResult(res);
        }
      } catch (err) {
        console.error('What-if API error:', err);
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Simulation unavailable. Please verify backend server is running.';
          setSimError(msg);
        }
      } finally {
        if (!cancelled) setIsComputing(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [baselineData, simulatedData]);

  const handleInputChange = (key: keyof PatientData, value: number) => {
    setActivePreset(null);
    setSimulatedData(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetToBaseline = () => {
    setActivePreset(null);
    setSimulatedData({ ...baselineData });
  };

  const applyPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    switch (presetKey) {
      case 'antihypertensive':
        setSimulatedData(prev => ({
          ...prev,
          trestbps: Math.max(115, baselineData.trestbps - 25),
        }));
        break;
      case 'statin':
        setSimulatedData(prev => ({
          ...prev,
          chol: Math.max(160, baselineData.chol - 55),
        }));
        break;
      case 'lifestyle':
        setSimulatedData(prev => ({
          ...prev,
          trestbps: Math.max(118, baselineData.trestbps - 15),
          chol: Math.max(175, baselineData.chol - 35),
          thalach: Math.min(170, baselineData.thalach + 15),
          exang: 0,
        }));
        break;
      case 'comprehensive':
        setSimulatedData(prev => ({
          ...prev,
          trestbps: 120,
          chol: 175,
          fbs: 0,
          thalach: Math.min(165, baselineData.thalach + 15),
          exang: 0,
          oldpeak: Math.max(0.2, Number((baselineData.oldpeak * 0.5).toFixed(1))),
        }));
        break;
    }
  };

  const handleCommitToPatient = () => {
    onApplyToPatient(simulatedData);
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 3000);
  };

  const liveSignals = React.useMemo(() => buildClinicalSignals(simulatedData, null), [simulatedData]);
  const riskDelta = simulationResult ? simulationResult.risk_delta : 0;
  const isImproved = riskDelta < 0;
  const isElevated = riskDelta > 0;

  // Check model saturation (<5% or >95%)
  const isSaturated = Boolean(
    simulationResult &&
    (simulationResult.baseline_score < 5 ||
     simulationResult.baseline_score > 95 ||
     simulationResult.simulated_score < 5 ||
     simulationResult.simulated_score > 95)
  );

  const getTierVariant = (tier?: string) => {
    switch (tier) {
      case 'Low': return 'success';
      case 'Moderate': return 'warning';
      case 'High': return 'warning';
      case 'Very high': return 'error';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="What-If Scenario Simulation"
        context={`Evaluate biomarker variations for ${
          currentPatient ? `${currentPatient.name || currentPatient.id} (${currentPatient.age ?? currentPatient.data?.age ?? 43} y/o)` : 'baseline case'
        }`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleResetToBaseline}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset to baseline
            </Button>
            <Button
              variant="primary"
              onClick={handleCommitToPatient}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              {appliedSuccess ? 'Applied to case' : 'Apply to patient case'}
            </Button>
          </div>
        }
      />

      {/* 2. Illustrative what-if scenarios */}
      <Panel className="p-3 bg-surface-alt/60">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption font-semibold text-text-secondary mr-2">
            Example Scenarios:
          </span>
          {[
            { key: 'antihypertensive', label: 'Lower BP input (-25 mmHg)' },
            { key: 'statin', label: 'Lower cholesterol input (-55 mg/dL)' },
            { key: 'lifestyle', label: 'Multiple-input scenario (BP, chol, HR)' },
            { key: 'comprehensive', label: 'Combined hypothetical scenario' },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={`px-3 py-1 text-caption font-medium rounded-xs border transition-colors cursor-pointer ${
                activePreset === preset.key
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface border-border text-text hover:bg-surface-alt'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Panel>

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Baseline vs Modified Inputs Table (7 cols) */}
        <div className="lg:col-span-7">
          <Panel className="p-4 space-y-4">
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <div>
                <h2 className="text-emphasis font-semibold text-text">
                  Baseline vs Modified Inputs
                </h2>
                <p className="text-caption text-text-secondary">
                  Adjust numerical inputs to explore model-output sensitivity
                </p>
              </div>
              <span className="text-caption text-text-tertiary">
                {isComputing ? 'Computing...' : 'Synchronized'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-caption border-collapse">
                <thead>
                  <tr className="border-b border-border text-text-tertiary">
                    <th className="text-left font-medium pb-2">Biomarker</th>
                    <th className="text-right font-medium pb-2 pr-4">Baseline</th>
                    <th className="text-left font-medium pb-2 min-w-[220px]">Modified Input</th>
                    <th className="text-right font-medium pb-2">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  
                  {/* 1. Resting Blood Pressure */}
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-2.5 text-text font-medium">
                      Resting blood pressure
                      <span className="text-text-tertiary block text-[11px]">trestbps (mmHg)</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-text-secondary pr-4">
                      {baselineData.trestbps}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={80}
                          max={220}
                          value={simulatedData.trestbps}
                          onChange={(e) => handleInputChange('trestbps', Number(e.target.value))}
                          className="flex-1 accent-accent h-1.5 bg-border rounded-xs cursor-pointer"
                        />
                        <input
                          type="number"
                          min={80}
                          max={220}
                          value={simulatedData.trestbps}
                          onChange={(e) => handleInputChange('trestbps', Number(e.target.value))}
                          className="w-16 h-7 px-1.5 text-caption font-mono tabular-nums text-right border border-border rounded-xs bg-surface text-text"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {simulatedData.trestbps - baselineData.trestbps === 0 ? (
                        <span className="text-text-tertiary">0</span>
                      ) : simulatedData.trestbps - baselineData.trestbps < 0 ? (
                        <span className="text-risk-low">{simulatedData.trestbps - baselineData.trestbps}</span>
                      ) : (
                        <span className="text-risk-high">+{simulatedData.trestbps - baselineData.trestbps}</span>
                      )}
                    </td>
                  </tr>

                  {/* 2. Serum Total Cholesterol */}
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-2.5 text-text font-medium">
                      Serum cholesterol
                      <span className="text-text-tertiary block text-[11px]">chol (mg/dL)</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-text-secondary pr-4">
                      {baselineData.chol}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={100}
                          max={600}
                          value={simulatedData.chol}
                          onChange={(e) => handleInputChange('chol', Number(e.target.value))}
                          className="flex-1 accent-accent h-1.5 bg-border rounded-xs cursor-pointer"
                        />
                        <input
                          type="number"
                          min={100}
                          max={600}
                          value={simulatedData.chol}
                          onChange={(e) => handleInputChange('chol', Number(e.target.value))}
                          className="w-16 h-7 px-1.5 text-caption font-mono tabular-nums text-right border border-border rounded-xs bg-surface text-text"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {simulatedData.chol - baselineData.chol === 0 ? (
                        <span className="text-text-tertiary">0</span>
                      ) : simulatedData.chol - baselineData.chol < 0 ? (
                        <span className="text-risk-low">{simulatedData.chol - baselineData.chol}</span>
                      ) : (
                        <span className="text-risk-high">+{simulatedData.chol - baselineData.chol}</span>
                      )}
                    </td>
                  </tr>

                  {/* 3. Max Heart Rate */}
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-2.5 text-text font-medium">
                      Max heart rate
                      <span className="text-text-tertiary block text-[11px]">thalach (bpm)</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-text-secondary pr-4">
                      {baselineData.thalach}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={60}
                          max={220}
                          value={simulatedData.thalach}
                          onChange={(e) => handleInputChange('thalach', Number(e.target.value))}
                          className="flex-1 accent-accent h-1.5 bg-border rounded-xs cursor-pointer"
                        />
                        <input
                          type="number"
                          min={60}
                          max={220}
                          value={simulatedData.thalach}
                          onChange={(e) => handleInputChange('thalach', Number(e.target.value))}
                          className="w-16 h-7 px-1.5 text-caption font-mono tabular-nums text-right border border-border rounded-xs bg-surface text-text"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {simulatedData.thalach - baselineData.thalach === 0 ? (
                        <span className="text-text-tertiary">0</span>
                      ) : simulatedData.thalach - baselineData.thalach > 0 ? (
                        <span className="text-risk-low">+{simulatedData.thalach - baselineData.thalach}</span>
                      ) : (
                        <span className="text-risk-high">{simulatedData.thalach - baselineData.thalach}</span>
                      )}
                    </td>
                  </tr>

                  {/* 4. ST Depression */}
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-2.5 text-text font-medium">
                      ST depression
                      <span className="text-text-tertiary block text-[11px]">oldpeak (mm)</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-text-secondary pr-4">
                      {baselineData.oldpeak.toFixed(1)}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={8.0}
                          step={0.1}
                          value={simulatedData.oldpeak}
                          onChange={(e) => handleInputChange('oldpeak', Number(e.target.value))}
                          className="flex-1 accent-accent h-1.5 bg-border rounded-xs cursor-pointer"
                        />
                        <input
                          type="number"
                          min={0}
                          max={8.0}
                          step={0.1}
                          value={simulatedData.oldpeak}
                          onChange={(e) => handleInputChange('oldpeak', Number(e.target.value))}
                          className="w-16 h-7 px-1.5 text-caption font-mono tabular-nums text-right border border-border rounded-xs bg-surface text-text"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold">
                      {(simulatedData.oldpeak - baselineData.oldpeak).toFixed(1) === '0.0' ? (
                        <span className="text-text-tertiary">0.0</span>
                      ) : simulatedData.oldpeak - baselineData.oldpeak < 0 ? (
                        <span className="text-risk-low">{(simulatedData.oldpeak - baselineData.oldpeak).toFixed(1)}</span>
                      ) : (
                        <span className="text-risk-high">+{(simulatedData.oldpeak - baselineData.oldpeak).toFixed(1)}</span>
                      )}
                    </td>
                  </tr>

                  {/* 5. Exercise Angina */}
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-2.5 text-text font-medium">
                      Exercise angina
                      <span className="text-text-tertiary block text-[11px]">exang</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-text-secondary pr-4">
                      {baselineData.exang === 1 ? 'Present' : 'Absent'}
                    </td>
                    <td className="py-2.5">
                      <select
                        value={simulatedData.exang}
                        onChange={(e) => handleInputChange('exang', Number(e.target.value))}
                        className="w-full h-7 px-2 text-caption border border-border rounded-xs bg-surface text-text cursor-pointer"
                      >
                        <option value={0}>Absent (0)</option>
                        <option value={1}>Present (1)</option>
                      </select>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {simulatedData.exang !== baselineData.exang && (
                        <Tag variant={simulatedData.exang === 0 ? 'success' : 'error'}>
                          {simulatedData.exang === 0 ? 'Resolved' : 'Induced'}
                        </Tag>
                      )}
                    </td>
                  </tr>

                  {/* 6. Fluoroscopy Vessels */}
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-2.5 text-text font-medium">
                      Major vessels
                      <span className="text-text-tertiary block text-[11px]">ca (0–3)</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-text-secondary pr-4">
                      {baselineData.ca}
                    </td>
                    <td className="py-2.5">
                      <select
                        value={simulatedData.ca}
                        onChange={(e) => handleInputChange('ca', Number(e.target.value))}
                        className="w-full h-7 px-2 text-caption border border-border rounded-xs bg-surface text-text cursor-pointer"
                      >
                        <option value={0}>0 vessels colored</option>
                        <option value={1}>1 vessel colored</option>
                        <option value={2}>2 vessels colored</option>
                        <option value={3}>3 vessels colored</option>
                      </select>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {simulatedData.ca !== baselineData.ca && (
                        <span className={simulatedData.ca < baselineData.ca ? 'text-risk-low' : 'text-risk-high'}>
                          {simulatedData.ca - baselineData.ca > 0 ? `+${simulatedData.ca - baselineData.ca}` : `${simulatedData.ca - baselineData.ca}`}
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* 7. Fasting Blood Sugar */}
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-2.5 text-text font-medium">
                      Fasting blood sugar
                      <span className="text-text-tertiary block text-[11px]">fbs</span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-text-secondary pr-4">
                      {baselineData.fbs === 1 ? '> 120' : '≤ 120'}
                    </td>
                    <td className="py-2.5">
                      <select
                        value={simulatedData.fbs}
                        onChange={(e) => handleInputChange('fbs', Number(e.target.value))}
                        className="w-full h-7 px-2 text-caption border border-border rounded-xs bg-surface text-text cursor-pointer"
                      >
                        <option value={0}>≤ 120 mg/dL (Normal)</option>
                        <option value={1}>&gt; 120 mg/dL (Elevated)</option>
                      </select>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      {simulatedData.fbs !== baselineData.fbs && (
                        <Tag variant={simulatedData.fbs === 0 ? 'success' : 'error'}>
                          {simulatedData.fbs === 0 ? 'Normal' : 'Elevated'}
                        </Tag>
                      )}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {/* RIGHT COLUMN: Result Comparison & Delta (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Result Comparison Panel */}
          <Panel className="p-4 space-y-4">
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <div>
                <h2 className="text-emphasis font-semibold text-text">
                  Simulation Outcome
                </h2>
                <p className="text-caption text-text-secondary">
                  Calibrated ensemble score response to parameter variation
                </p>
              </div>
              {isComputing && (
                <Tag variant="default">Simulating...</Tag>
              )}
            </div>

            {simError && (
              <div className="p-2.5 rounded-xs bg-surface-alt border border-risk-high/40 text-caption text-risk-high flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{simError}</span>
              </div>
            )}

            {/* Score Side-by-side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Baseline */}
              <div className="p-3 rounded-xs border border-border bg-surface-alt/40 space-y-1">
                <span className="text-caption text-text-tertiary block">
                  Patient baseline
                </span>
                <div className="text-2xl font-mono font-semibold tabular-nums text-text">
                  {simulationResult ? `${simulationResult.baseline_score.toFixed(1)}%` : '--'}
                </div>
                <Tag variant={getTierVariant(simulationResult?.baseline_tier)}>
                  {simulationResult?.baseline_tier || 'Baseline'} band
                </Tag>
              </div>

              {/* Simulated */}
              <div className="p-3 rounded-xs border border-border bg-surface-alt/40 space-y-1">
                <span className="text-caption text-text-tertiary block">
                  Simulated outcome
                </span>
                <div className="text-2xl font-mono font-semibold tabular-nums text-text">
                  {simulationResult ? `${simulationResult.simulated_score.toFixed(1)}%` : '--'}
                </div>
                <Tag variant={getTierVariant(simulationResult?.simulated_tier)}>
                  {simulationResult?.simulated_tier || 'Simulated'} band
                </Tag>
              </div>
            </div>

            {/* Net Delta Callout */}
            <div className="p-3 rounded-xs border border-border bg-surface-alt/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {isImproved ? (
                  <TrendingDown className="w-5 h-5 text-risk-low shrink-0" />
                ) : isElevated ? (
                  <TrendingUp className="w-5 h-5 text-risk-high shrink-0" />
                ) : (
                  <Minus className="w-5 h-5 text-text-tertiary shrink-0" />
                )}
                <div>
                  <span className="text-body font-semibold text-text block">
                    Change in model score
                  </span>
                  <span className="text-caption text-text-secondary">
                    Net probability delta
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className={`text-2xl font-mono font-semibold tabular-nums ${
                  isImproved ? 'text-risk-low' : isElevated ? 'text-risk-high' : 'text-text-secondary'
                }`}>
                  {riskDelta > 0 ? `+${riskDelta.toFixed(1)}%` : `${riskDelta.toFixed(1)}%`}
                </span>
              </div>
            </div>

            {/* Saturation Notice when scores near 0 or 100 */}
            {isSaturated && (
              <div className="p-3 rounded-xs border border-risk-mod/30 bg-risk-mod/15 text-risk-mod space-y-1 text-caption">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-risk-mod shrink-0" />
                  <span>Model saturation notice</span>
                </div>
                <p className="text-[12px] leading-relaxed text-text-secondary">
                  The model score is near the boundary (&lt;5% or &gt;95%). Due to probability sigmoid saturation, incremental biomarker shifts may register minimal changes in final score. This score behavior does not describe treatment effects or real-world health outcomes.
                </p>
              </div>
            )}

            {/* Bar comparison visualization */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-caption text-text-secondary block font-medium">
                Visual Score Comparison
              </span>

              {/* Baseline Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-caption text-text-secondary">
                  <span>Baseline</span>
                  <span className="font-mono tabular-nums">{simulationResult?.baseline_score.toFixed(1)}%</span>
                </div>
                <div className="h-3 w-full bg-border rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-text-secondary transition-all"
                    style={{ width: `${simulationResult?.baseline_score || 0}%` }}
                  />
                </div>
              </div>

              {/* Simulated Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-caption text-text-secondary">
                  <span>Simulated</span>
                  <span className="font-mono tabular-nums">{simulationResult?.simulated_score.toFixed(1)}%</span>
                </div>
                <div className="h-3 w-full bg-border rounded-xs overflow-hidden">
                  <div
                    className={`h-full transition-all ${isImproved ? 'bg-risk-low' : isElevated ? 'bg-risk-high' : 'bg-accent'}`}
                    style={{ width: `${simulationResult?.simulated_score || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Simulation notes */}
            <div className="text-caption text-text-secondary p-3 rounded-xs bg-surface-alt/40 border border-border space-y-1">
              <span className="font-semibold text-text block">Simulation note:</span>
              <p>
                {simulationResult?.clinical_notes || 'Adjust parameters on the left to evaluate sensitivity.'}
              </p>
            </div>

            {/* Apply Action */}
            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={handleCommitToPatient}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                {appliedSuccess ? 'Applied to patient case!' : 'Apply scenario to patient profile'}
              </Button>
            </div>
          </Panel>

        </div>

      </div>
      
      {/* Real patient-linked 3D visual layer: sliders update schematic markers immediately;
          the ring updates only after the backend what-if API returns a fresh score. */}
      <section className="scenario-heart-live" aria-label="Live 3D hypothetical heart overlay">
        <div className="scenario-heart-copy">
          <span className="scenario-heart-kicker">LIVE LINK · CLINICAL INPUT → 3D VIEW</span>
          <h2>Change a value. <em>See the signal.</em></h2>
          <p>The visualization reflects your modified record. Markers update with the sliders; the model score updates after the real prediction finishes.</p>
          <div className="scenario-heart-pills">
            <span>BP {simulatedData.trestbps} mmHg</span>
            <span>Chol {simulatedData.chol} mg/dL</span>
            <span>ST {simulatedData.oldpeak}</span>
          </div>
          <div className="scenario-heart-scores">
            <div><span>BASELINE</span><strong>{simulationResult ? `${simulationResult.baseline_score.toFixed(1)}%` : '—'}</strong></div>
            <div><span>SCENARIO {isComputing ? '· UPDATING' : ''}</span><strong>{simulationResult && !isComputing ? `${simulationResult.simulated_score.toFixed(1)}%` : '…'}</strong></div>
          </div>
          <small>Illustrative model-associated signals only. Not anatomy, blockage localization or treatment-effect prediction.</small>
        </div>
        <div className="scenario-heart-stage"><HeartViewer3D
          clinicalSignals={liveSignals} showSignalOverlay={true}
          modelScore={!isComputing && !simError ? simulationResult?.simulated_score : null}
          onSignalSelect={() => {}}
        /></div>
      </section>

      {/* Educational & Research Disclaimer */}
      <div className="text-caption text-text-tertiary flex items-start gap-1.5 pt-2">
        <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-text-secondary">Disclaimer:</strong> What-If scenarios model purely hypothetical parameter changes for sensitivity evaluation and research exploration. They do not constitute clinical guidance, prescription recommendations, or diagnostic treatment plans.
        </p>
      </div>

    </div>
  );
}
