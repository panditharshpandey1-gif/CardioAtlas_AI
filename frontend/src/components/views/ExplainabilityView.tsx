import React, { useState } from 'react';
import { ShapExplanation, PatientProfile, TreeShapExplanation } from '../../types/cardio';
import { fetchTreeShap } from '../../services/api';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { Tag } from '../ui/Tag';
import { Button } from '../ui/Button';
import { SlidersHorizontal, Info, Activity } from 'lucide-react';

interface ExplainabilityViewProps {
  explanation: ShapExplanation | null;
  patient: PatientProfile | null;
  onNavigateToWhatIf: () => void;
  backendOnline?: boolean;
  isLoading?: boolean;
}

export function ExplainabilityView({
  explanation,
  patient,
  onNavigateToWhatIf,
  backendOnline = true,
  isLoading = false,
}: ExplainabilityViewProps) {
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('cardiovision_explain_tab');
      if (saved && ['chart', 'table'].includes(saved)) {
        return saved as 'chart' | 'table';
      }
    } catch {}
    return 'chart';
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('cardiovision_explain_tab', activeTab);
    } catch {}
  }, [activeTab]);
  const [filterMode, setFilterMode] = useState<'all' | 'risk_drivers' | 'protective'>('all');

  const [treeShap, setTreeShap] = React.useState<TreeShapExplanation | null>(null);
  const [shapError, setShapError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setTreeShap(null); setShapError(null);
    if (patient?.data && backendOnline) {
      fetchTreeShap(patient.data).then(value => { if (!cancelled) setTreeShap(value); })
        .catch(error => { if (!cancelled) setShapError(error instanceof Error ? error.message : 'SHAP unavailable'); });
    }
    return () => { cancelled = true; };
  }, [patient, backendOnline]);

  if (!explanation) {
    if (!backendOnline) {
      return (
        <Panel className="p-8 text-center text-text-secondary max-w-xl mx-auto my-12 space-y-3">
          <Activity className="w-6 h-6 text-warning mx-auto" />
          <h3 className="text-emphasis font-semibold text-text">Backend Offline</h3>
          <p className="text-caption text-text-tertiary">
            Feature attributions require a live backend connection. Please start the backend service using <code className="font-mono bg-surface-alt px-1.5 py-0.5 rounded">python run.py</code>.
          </p>
        </Panel>
      );
    }

    if (!isLoading) {
      return (
        <Panel className="p-8 text-center text-text-secondary max-w-xl mx-auto my-12 space-y-3">
          <Activity className="w-6 h-6 text-warning mx-auto" />
          <h3 className="text-emphasis font-semibold text-text">
            Feature Attributions Unavailable
          </h3>
          <p className="text-caption text-text-tertiary">
            Unable to compute biomarker attributions for this patient. Please verify the backend service is running.
          </p>
        </Panel>
      );
    }

    return (
      <Panel className="p-8 text-center text-text-secondary max-w-xl mx-auto my-12 space-y-3">
        <Activity className="w-6 h-6 text-accent mx-auto animate-pulse" />
        <h3 className="text-emphasis font-semibold text-text">
          Computing feature attributions...
        </h3>
        <p className="text-caption text-text-tertiary">
          Perturbing inputs against the training cohort population baseline...
        </p>
      </Panel>
    );
  }

  // Filter feature contributions
  const allContributions = [...explanation.feature_contributions].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
  );

  const displayedContributions = allContributions.filter((item) => {
    if (filterMode === 'risk_drivers') return item.contribution > 0;
    if (filterMode === 'protective') return item.contribution < 0;
    return true;
  });

  // Marginal perturbation geometry setup
  const svgWidth = 840;
  const rowHeight = 24;
  const labelWidth = 260;
  const valueWidth = 90;
  const plotWidth = svgWidth - labelWidth - valueWidth;
  
  const totalRows = allContributions.length + 1;
  const svgHeight = totalRows * rowHeight + 36;

  const baseVal = Math.min(100, Math.max(0, explanation.base_value));

  const scaleX = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    return labelWidth + (clamped / 100) * plotWidth;
  };

  const baseX = scaleX(baseVal);

  return (
    <div className="space-y-6">
      {/* 1. Page Header (24px gap before content) */}
      <PageHeader
        title="Feature Contributions"
        context={`One-at-a-time perturbation attribution for ${
          patient ? `${patient.name || patient.id} (${patient.age ?? patient.data?.age ?? 43} y/o)` : 'the active case'
        }`}
        actions={
          <div className="flex items-center gap-2">
            <Tag variant="info">UCI Cleveland baseline mean</Tag>
            <Button
              variant="secondary"
              onClick={onNavigateToWhatIf}
              icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            >
              Test in what-if lab
            </Button>
          </div>
        }
      />

      <section className="atlas-shap-panel">
        <div className="atlas-shap-top"><div><span className="atlas-shap-eyebrow">EXPLAINABLE INTELLIGENCE / EXACT TREE SHAP</span><h2>Why did the model respond this way?</h2>
          <p>Genuine TreeSHAP waterfall for the <strong>raw Gradient Boosting component</strong> (log-odds). This is NOT an attribution of the calibrated 3-model ensemble.</p></div>
          <span className="atlas-shap-value">{treeShap ? `${treeShap.prediction_probability.toFixed(1)}%` : '—'}<small>GB component only</small></span></div>
        {treeShap ? <div className="atlas-shap-bars"><div className="atlas-shap-baseline">BASE VALUE (LOG-ODDS): {treeShap.base_log_odds.toFixed(2)} → OUTPUT: {treeShap.prediction_log_odds.toFixed(2)}</div>
          {treeShap.features.slice(0, 9).map((item) => <div className="atlas-shap-row" key={item.feature}>
            <span>{item.label}</span><div className="atlas-shap-axis"><div className={item.shap_log_odds >= 0 ? 'positive' : 'negative'} style={{width:`${Math.min(47,Math.abs(item.shap_log_odds)*18)}%`,marginLeft:item.shap_log_odds >= 0 ? '50%' : `${50-Math.min(47,Math.abs(item.shap_log_odds)*18)}%`}}/></div>
            <b>{item.shap_log_odds >= 0 ? '+' : ''}{item.shap_log_odds.toFixed(2)}</b>
          </div>)}
        </div> : <p className="atlas-shap-loading">{shapError ? `SHAP unavailable: ${shapError}` : 'Computing TreeSHAP from the trained model…'}</p>}
        <small>Bars are additive in log-odds for the uncalibrated GB model; no causal or diagnostic claim.</small>
      </section>

      {/* 2. In-Page Tab Navigation: [Chart] [Show table] */}
      <div className="flex items-center border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('chart')}
          className={`pb-2 px-3 text-body font-medium transition-colors cursor-pointer border-b-2 ${
            activeTab === 'chart'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Chart
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('table')}
          className={`pb-2 px-3 text-body font-medium transition-colors cursor-pointer border-b-2 ${
            activeTab === 'table'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Show table
        </button>
      </div>

      {/* 3. TAB 1: Marginal Sensitivity Chart */}
      {activeTab === 'chart' && (
        <div className="space-y-3">
          {/* Baseline Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Panel className="p-2.5 space-y-0.5">
              <span className="text-caption text-text-tertiary block">
                Cohort baseline mean
              </span>
              <div className="text-lg font-semibold font-mono tabular-nums text-text">
                {explanation.base_value.toFixed(1)}%
              </div>
              <p className="text-[11px] text-text-secondary">
                Expected score at Cleveland training feature means
              </p>
            </Panel>

            <Panel className="p-2.5 space-y-0.5">
              <span className="text-caption text-text-tertiary block">
                Reference model score
              </span>
              <div className="text-lg font-semibold font-mono tabular-nums text-text">
                {explanation.predicted_value.toFixed(1)}%
              </div>
              <p className="text-[11px] text-text-secondary">
                Gradient Boosting model score for attribution target
              </p>
            </Panel>

            <Panel className="p-2.5 space-y-0.5">
              <span className="text-caption text-text-tertiary block">
                Net attributed change
              </span>
              <div className={`text-lg font-semibold font-mono tabular-nums ${
                explanation.total_delta > 0 ? 'text-risk-high' : 'text-risk-low'
              }`}>
                {explanation.total_delta > 0
                  ? `+${explanation.total_delta.toFixed(1)}%`
                  : `${explanation.total_delta.toFixed(1)}%`}
              </div>
              <p className="text-[11px] text-text-secondary">
                {explanation.total_delta > 0 ? 'Score increase vs baseline' : 'Score reduction vs baseline'}
              </p>
            </Panel>
          </div>

          {/* Marginal Attribution SVG Chart */}
          <Panel className="p-4 space-y-3">
            <div className="border-b border-border pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-emphasis font-semibold text-text">
                  Marginal Biomarker Sensitivity
                </h2>
                <p className="text-caption text-text-secondary">
                  Independent marginal perturbation displacement from Cleveland cohort mean baseline ({explanation.base_value.toFixed(1)}%)
                </p>
              </div>

              <div className="flex items-center gap-3 text-caption text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-accent rounded-xs" />
                  <span>Increases score (blue)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-text-secondary rounded-xs" />
                  <span>Reduces score (slate)</span>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full min-w-[720px] text-caption select-none"
                style={{ height: 'auto', maxHeight: `${svgHeight}px` }}
              >
                {/* Grid lines & Ticks */}
                {[0, 25, 50, 75, 100].map((tick) => {
                  const x = scaleX(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={x}
                        y1={6}
                        x2={x}
                        y2={svgHeight - 20}
                        stroke="#E2E8F0"
                        strokeWidth="1"
                        strokeDasharray={tick === 0 || tick === 100 ? undefined : '2,2'}
                      />
                      <text
                        x={x}
                        y={svgHeight - 6}
                        textAnchor="middle"
                        fill="#64748B"
                        fontSize="10"
                        fontFamily="IBM Plex Mono"
                      >
                        {tick}%
                      </text>
                    </g>
                  );
                })}

                {/* Cohort Baseline Vertical Reference Line */}
                <line
                  x1={baseX}
                  y1={6}
                  x2={baseX}
                  y2={svgHeight - 20}
                  stroke="#0284C7"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                />
                <text
                  x={baseX}
                  y={14}
                  textAnchor="middle"
                  fill="#0284C7"
                  fontSize="9"
                  fontFamily="IBM Plex Mono"
                  fontWeight="600"
                >
                  Baseline {baseVal.toFixed(1)}%
                </text>

                {/* Marginal feature bars (each starting from baseline) */}
                {allContributions.map((item, idx) => {
                  const y = (idx + 1) * rowHeight + 8;
                  const isPositive = item.contribution > 0;
                  const targetVal = Math.min(100, Math.max(0, baseVal + item.contribution));
                  const targetX = scaleX(targetVal);

                  const barLeft = Math.min(baseX, targetX);
                  const barWidth = Math.max(3, Math.abs(targetX - baseX));
                  const barColor = isPositive ? '#2563EB' : '#64748B';

                  return (
                    <g key={item.feature} transform={`translate(0, ${y})`}>
                      <text
                        x={labelWidth - 12}
                        y={11}
                        textAnchor="end"
                        fill="#1E293B"
                        fontSize="11"
                        fontWeight="500"
                      >
                        {item.label || item.feature}
                      </text>

                      <rect
                        x={barLeft}
                        y={0}
                        width={barWidth}
                        height={14}
                        fill={barColor}
                        rx="2"
                      />

                      <text
                        x={svgWidth - 10}
                        y={11}
                        textAnchor="end"
                        fill={barColor}
                        fontFamily="IBM Plex Mono"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {isPositive ? `+${item.contribution.toFixed(1)}%` : `${item.contribution.toFixed(1)}%`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Non-additivity methodology disclosure */}
            <div className="p-3 bg-surface-alt rounded-xs border border-border/80 text-[11px] text-text-secondary flex items-start gap-2">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                <strong>Attribution Methodology:</strong> One-at-a-time marginal perturbation evaluated against the Cleveland training cohort mean baseline ({explanation.base_value.toFixed(1)}%). Each bar reflects the independent sensitivity of altering that biomarker alone; these values are independent marginal effects, not additive components that sum to the ensemble prediction.
              </span>
            </div>
          </Panel>
        </div>
      )}

      {/* 4. TAB 2: Contribution Table Only */}
      {activeTab === 'table' && (
        <Panel className="p-4 space-y-3">
          <div className="border-b border-border pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-emphasis font-semibold text-text">Biomarker Contribution Table</h2>
              <p className="text-caption text-text-secondary">
                Feature values, population baseline references, and signed impact
              </p>
            </div>

            <div className="flex items-center gap-1 border border-border rounded-xs p-0.5 bg-surface-alt">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2 py-0.5 text-caption rounded-xs transition-colors cursor-pointer ${
                  filterMode === 'all' ? 'bg-surface font-semibold text-text border border-border' : 'text-text-secondary'
                }`}
              >
                All ({allContributions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('risk_drivers')}
                className={`px-2 py-0.5 text-caption rounded-xs transition-colors cursor-pointer ${
                  filterMode === 'risk_drivers' ? 'bg-surface font-semibold text-text border border-border' : 'text-text-secondary'
                }`}
              >
                Risk drivers (+)
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('protective')}
                className={`px-2 py-0.5 text-caption rounded-xs transition-colors cursor-pointer ${
                  filterMode === 'protective' ? 'bg-surface font-semibold text-text border border-border' : 'text-text-secondary'
                }`}
              >
                Protective (-)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-body border-collapse">
              <thead>
                <tr className="border-b border-border text-caption text-text-secondary">
                  <th className="text-left font-semibold py-2">Biomarker</th>
                  <th className="text-right font-semibold py-2">Patient Value</th>
                  <th className="text-right font-semibold py-2">Baseline Mean</th>
                  <th className="text-center font-semibold py-2">Effect Direction</th>
                  <th className="text-right font-semibold py-2">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {displayedContributions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-tertiary text-caption">
                      No biomarkers found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  displayedContributions.map((c) => {
                  const isPositive = c.contribution > 0;
                  return (
                    <tr key={c.feature} className="h-9 hover:bg-surface-alt/50">
                      <td className="py-2 text-text font-medium text-caption">
                        {c.label || c.feature}
                        <span className="text-text-tertiary ml-1 font-mono text-[11px]">
                          ({c.feature})
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-text text-caption">
                        {c.patient_value}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-text-secondary text-caption">
                        {c.baseline_value !== undefined ? c.baseline_value.toFixed(1) : '—'}
                      </td>
                      <td className="py-2 text-center">
                        <Tag variant={isPositive ? 'warning' : 'success'}>
                          {isPositive ? 'Increases score' : 'Reduces score'}
                        </Tag>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums font-semibold text-caption">
                        <span className={isPositive ? 'text-accent' : 'text-text-secondary'}>
                          {isPositive ? `+${c.contribution.toFixed(1)}%` : `${c.contribution.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* 5. Method Note below in small text */}
      <div className="text-caption text-text-tertiary flex items-start gap-1.5 pt-1">
        <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-text-secondary">Method:</strong> Feature contributions (one-at-a-time perturbation) calculated against 242 Cleveland training cases. Single-factor sensitivity isolates marginal effect without cooperative interactions.
        </p>
      </div>

    </div>
  );
}
