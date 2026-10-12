import React from 'react';
import { Panel } from './Panel';

export interface ResultBlockProps {
  score: number;
  tier: 'Low' | 'Moderate' | 'High' | 'Very high' | 'Critical';
  models: {
    ensemble: number;
    gradient_boosting: number;
    random_forest: number;
    logistic_regression: number;
  };
  disclaimer?: string;
  showAgreementTable?: boolean;
  showInterpretDetails?: boolean;
}

const BANDS = [
  { id: 'Low', label: 'Low', range: '0–25%', min: 0, max: 25, colorClass: 'bg-risk-low', meaning: 'Lower model score' },
  { id: 'Moderate', label: 'Moderate', range: '25–50%', min: 25, max: 50, colorClass: 'bg-risk-mod', meaning: 'Intermediate model score' },
  { id: 'High', label: 'High', range: '50–75%', min: 50, max: 75, colorClass: 'bg-risk-high', meaning: 'Higher model score' },
  { id: 'Very high', label: 'Very high', range: '75–100%', min: 75, max: 100, colorClass: 'bg-risk-vhigh', meaning: 'Highest model score' },
] as const;

export function ResultBlock({
  score,
  tier,
  models,
  disclaimer,
  showAgreementTable = true,
  showInterpretDetails = true,
}: ResultBlockProps) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const activeTierId = tier === 'Critical' ? 'Very high' : tier;

  return (
    <Panel className="p-4 space-y-6">
      {/* 1. Score display */}
      <div>
        <div className="text-caption text-text-2 font-medium">
          Model score
        </div>
        <div className="text-result font-mono font-semibold text-text leading-tight my-1">
          {clampedScore.toFixed(1)}%
        </div>
        <div className="text-caption text-text-3">
          Calibrated ensemble output trained on UCI Cleveland cohort (n=303)
        </div>
      </div>

      {/* 2. Horizontal segmented scale */}
      <div className="space-y-1.5">
        <div className="relative pt-2">
          {/* Triangle marker at score position */}
          <div
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${clampedScore}%`, transform: 'translateX(-50%)' }}
            aria-hidden="true"
          >
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-text" />
          </div>

          {/* 4 equal segments with 1px gaps */}
          <div className="grid grid-cols-4 gap-[1px] h-3.5 bg-border rounded-sm overflow-hidden p-[1px]">
            {BANDS.map((b) => {
              const isActive = activeTierId === b.id;
              return (
                <div
                  key={b.id}
                  className={[
                    'h-full transition-colors',
                    isActive ? b.colorClass : 'bg-surface-alt border border-border',
                  ].join(' ')}
                />
              );
            })}
          </div>
        </div>

        {/* Band names written as text under each segment */}
        <div className="grid grid-cols-4 text-center">
          {BANDS.map((b) => {
            const isActive = activeTierId === b.id;
            return (
              <div key={b.id} className="text-caption">
                <span className={isActive ? 'font-semibold text-text' : 'text-text-3'}>
                  {b.label}
                </span>
                <span className="block text-caption text-text-3 font-mono">
                  {b.range}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 4-row Interpretation Table (collapsed inside Band definitions) */}
      <details className="border border-border rounded-xs overflow-hidden text-caption">
        <summary className="py-2 px-3 bg-surface-alt font-medium text-text cursor-pointer hover:text-accent select-none transition-colors">
          Band definitions
        </summary>
        <table className="w-full text-left text-body border-collapse tabular-nums border-t border-border">
          <thead className="bg-surface-alt/70 border-b border-border text-caption font-semibold text-text-2">
            <tr>
              <th className="py-1.5 px-3">Band</th>
              <th className="py-1.5 px-3">Score range</th>
              <th className="py-1.5 px-3">Meaning in this tool</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-caption">
            {BANDS.map((b) => {
              const isActive = activeTierId === b.id;
              return (
                <tr
                  key={b.id}
                  className={isActive ? 'bg-accent-bg text-text font-medium' : 'text-text-2'}
                >
                  <td className="py-1.5 px-3 font-medium">{b.label}</td>
                  <td className="py-1.5 px-3 font-mono">{b.range}</td>
                  <td className="py-1.5 px-3">{b.meaning}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      {/* 4. Model agreement Table */}
      {showAgreementTable && (
        <div className="border border-border rounded-sm overflow-hidden">
          <div className="bg-surface-alt px-3 py-1.5 border-b border-border text-caption font-semibold text-text-2">
            Model agreement
          </div>
          <table className="w-full text-left text-body border-collapse tabular-nums">
            <tbody className="divide-y divide-border text-caption">
              <tr className="text-text-2">
                <td className="py-1.5 px-3">Gradient boosting</td>
                <td className="py-1.5 px-3 text-right font-mono text-text font-medium">
                  {models.gradient_boosting.toFixed(1)}%
                </td>
              </tr>
              <tr className="text-text-2">
                <td className="py-1.5 px-3">Random forest</td>
                <td className="py-1.5 px-3 text-right font-mono text-text font-medium">
                  {models.random_forest.toFixed(1)}%
                </td>
              </tr>
              <tr className="text-text-2">
                <td className="py-1.5 px-3">Logistic regression</td>
                <td className="py-1.5 px-3 text-right font-mono text-text font-medium">
                  {models.logistic_regression.toFixed(1)}%
                </td>
              </tr>
              <tr className="bg-surface-alt text-text font-semibold">
                <td className="py-1.5 px-3">Ensemble</td>
                <td className="py-1.5 px-3 text-right font-mono font-semibold">
                  {models.ensemble.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Three native details */}
      {showInterpretDetails && (
        <div className="space-y-2 border-t border-border pt-4 text-body">
          <details className="group border border-border rounded-sm p-2 bg-surface">
            <summary className="cursor-pointer font-medium text-caption text-text select-none outline-none">
              How to read this
            </summary>
            <div className="pt-2 text-caption text-text-2 leading-relaxed border-t border-border mt-2">
              This score represents the calibrated posterior probability from a consensus ensemble (Gradient Boosting, Random Forest, Logistic Regression). Bands indicate calibrated risk tiers.
            </div>
          </details>

          <details className="group border border-border rounded-sm p-2 bg-surface">
            <summary className="cursor-pointer font-medium text-caption text-text select-none outline-none">
              Limitations
            </summary>
            <div className="pt-2 text-caption text-text-2 leading-relaxed border-t border-border mt-2">
              Educational research prototype. Not an FDA-cleared diagnostic device. Direct clinical therapeutic intervention requires comprehensive medical evaluation.
            </div>
          </details>

          <details className="group border border-border rounded-sm p-2 bg-surface">
            <summary className="cursor-pointer font-medium text-caption text-text select-none outline-none">
              References
            </summary>
            <div className="pt-2 text-caption text-text-2 leading-relaxed border-t border-border mt-2">
              Detrano R et al. Am J Cardiol 1989;64(5):304–310. UCI Machine Learning Repository: Heart Disease Dataset.
            </div>
          </details>
        </div>
      )}

      {disclaimer && (
        <div className="text-caption text-text-3 pt-2 border-t border-border">
          {disclaimer}
        </div>
      )}
    </Panel>
  );
}
