import React, { useState, useEffect } from 'react';
import { ModelMetricsResponse } from '../../types/cardio';
import { apiService } from '../../services/api';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { Tag } from '../ui/Tag';
import { Skeleton } from '../ui/Skeleton';

export function ModelCardView() {
  const [activeTab, setActiveTab] = useState<'overview' | 'test' | 'cv' | 'calibration' | 'limitations'>(() => {
    try {
      const saved = localStorage.getItem('cardiovision_modelcard_tab');
      if (saved && ['overview', 'test', 'cv', 'calibration', 'limitations'].includes(saved)) {
        return saved as 'overview' | 'test' | 'cv' | 'calibration' | 'limitations';
      }
    } catch {}
    return 'overview';
  });

  useEffect(() => {
    try {
      localStorage.setItem('cardiovision_modelcard_tab', activeTab);
    } catch {}
  }, [activeTab]);
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    apiService.getModelMetrics().then((res) => {
      if (!cancelled) {
        setMetrics(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. Page Header (24px gap before content) */}
      <PageHeader
        title="Model Card & Specifications"
        context="Full algorithmic transparency dossier, dataset provenance, and validation metrics."
        actions={
          <Tag variant="info">
            {metrics ? `Dataset: ${metrics.dataset.name} (n=${metrics.dataset.n_rows})` : 'UCI Cleveland Dataset'}
          </Tag>
        }
      />

      {/* 2. In-Page Tab Navigation (Progressive Disclosure) */}
      <div className="flex items-center border-b border-border gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-2 px-3 text-body font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('test')}
          className={`pb-2 px-3 text-body font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'test'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Test metrics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cv')}
          className={`pb-2 px-3 text-body font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'cv'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Cross-validation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('calibration')}
          className={`pb-2 px-3 text-body font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'calibration'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Calibration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('limitations')}
          className={`pb-2 px-3 text-body font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'limitations'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Limitations and references
        </button>
      </div>

      {loading ? (
        <Panel className="p-6">
          <Skeleton rows={6} />
        </Panel>
      ) : !metrics && activeTab !== 'overview' ? (
        <Panel className="p-8 text-center text-text-secondary max-w-xl mx-auto my-12 space-y-3">
          <h3 className="text-emphasis font-semibold text-text">Evaluation Metrics Unavailable</h3>
          <p className="text-caption text-text-tertiary">
            Unable to retrieve validated model metrics from the backend service. Please verify that the backend is online and running.
          </p>
        </Panel>
      ) : (
        <>
          {metrics && <div className="atlas-evidence-strip">
            <div><span>PRIMARY INTERNAL BENCHMARK</span><strong>{metrics.cv[0]?.accuracy ? `${(metrics.cv[0].accuracy.mean*100).toFixed(1)}%` : '—'}</strong><small>5-fold CV accuracy, training n=242</small></div>
            <div><span>HELD-OUT ACCURACY</span><strong>{metrics.test[0]?.accuracy ? `${(metrics.test[0].accuracy.value*100).toFixed(1)}%` : '—'}</strong><small>95% bootstrap CI: {metrics.test[0]?.accuracy ? `${(metrics.test[0].accuracy.ci_low*100).toFixed(0)}–${(metrics.test[0].accuracy.ci_high*100).toFixed(0)}%` : '—'}</small></div>
            <div><span>HELD-OUT BRIER</span><strong>{metrics.test[0]?.brier.value.toFixed(3)}</strong><small>n={metrics.dataset.n_test}; calibration is not external validation</small></div>
          </div>}
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8">
                <Panel className="p-4 space-y-4">
                  <div className="border-b border-border pb-2">
                    <h2 className="text-emphasis font-semibold text-text">Model Architecture & Training</h2>
                    <p className="text-caption text-text-secondary">
                      Multi-algorithm ensemble with sigmoid probability calibration
                    </p>
                  </div>

                  <div className="space-y-3 text-caption text-text-secondary leading-relaxed">
                    <p>
                      <strong className="text-text">Primary Model:</strong> Unweighted ensemble combining Gradient Boosting Classifier, Random Forest Classifier, and Logistic Regression with L2 regularization.
                    </p>
                    <p>
                      <strong className="text-text">Preprocessing:</strong> Leakage-free median imputation fitted strictly on the 80% training split. Numeric features standard-scaled for linear models; tree models receive raw imputed features.
                    </p>
                    <p>
                      <strong className="text-text">Calibration:</strong> Each base estimator is wrapped in <code>CalibratedClassifierCV(method="sigmoid", cv=5)</code> to improve score calibration on internal training folds; prospective clinical calibration is not established.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
                    <div className="p-2.5 rounded-xs bg-surface-alt/50 border border-border">
                      <span className="text-caption text-text-tertiary block">Total Cohort</span>
                      <span className="text-body font-mono font-semibold text-text">303 patients</span>
                    </div>
                    <div className="p-2.5 rounded-xs bg-surface-alt/50 border border-border">
                      <span className="text-caption text-text-tertiary block">Training Split</span>
                      <span className="text-body font-mono font-semibold text-text">242 (80%)</span>
                    </div>
                    <div className="p-2.5 rounded-xs bg-surface-alt/50 border border-border">
                      <span className="text-caption text-text-tertiary block">Held-Out Test</span>
                      <span className="text-body font-mono font-semibold text-text">61 (20%)</span>
                    </div>
                    <div className="p-2.5 rounded-xs bg-surface-alt/50 border border-border">
                      <span className="text-caption text-text-tertiary block">CAD Positive Rate</span>
                      <span className="text-body font-mono font-semibold text-text">45.9%</span>
                    </div>
                  </div>
                </Panel>
              </div>

              <div className="lg:col-span-4">
                <Panel className="p-4 space-y-3 bg-surface-alt/40 text-caption text-text-secondary leading-relaxed">
                  <span className="text-body font-semibold text-text block">Clinical Purpose</span>
                  <p>
                    Developed as an educational and investigational research prototype for demonstrating multi-classifier consensus and explainable biomarker attribution.
                  </p>
                  <p>
                    Not an FDA-cleared diagnostic device. Direct clinical therapeutic intervention should only be prescribed following comprehensive medical evaluation.
                  </p>
                </Panel>
              </div>
            </div>
          )}

          {/* TAB 2: TEST METRICS */}
          {activeTab === 'test' && metrics && (
            <Panel className="p-4 space-y-4">
              <div className="border-b border-border pb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-emphasis font-semibold text-text">Held-Out Test Set Performance (n=61)</h2>
                  <p className="text-caption text-text-secondary">
                    Evaluated with 1,000 bootstrap resamples (95% Confidence Intervals) at threshold 0.50
                  </p>
                </div>
                <Tag variant="default">Decision Threshold: 0.50</Tag>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-caption border-collapse">
                  <thead>
                    <tr className="border-b border-border text-text-secondary">
                      <th className="text-left font-semibold py-2">Model Architecture</th>
                      <th className="text-right font-semibold py-2">ROC-AUC [95% CI]</th>
                      <th className="text-right font-semibold py-2">PR-AUC [95% CI]</th>
                      <th className="text-right font-semibold py-2">Accuracy [95% CI]</th>
                      <th className="text-right font-semibold py-2">Precision [95% CI]</th>
                      <th className="text-right font-semibold py-2">Sensitivity [95% CI]</th>
                      <th className="text-right font-semibold py-2">Specificity [95% CI]</th>
                      <th className="text-right font-semibold py-2">F1 [95% CI]</th>
                      <th className="text-right font-semibold py-2">Brier Score</th>
                      <th className="text-right font-semibold py-2">Confusion Matrix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {metrics.test.map((m, idx) => (
                      <tr key={m.name} className={`h-10 ${idx === 0 ? 'bg-accent/10 font-medium' : 'hover:bg-surface-alt/50'}`}>
                        <td className="py-2 text-text font-medium text-body">
                          {m.name}
                          {m.status === 'Primary' && (
                            <span className="ml-1.5 text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-xs">
                              Primary
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text font-semibold">
                          {m.roc_auc.value.toFixed(3)}
                          <span className="text-text-tertiary ml-1 text-[11px]">
                            [{m.roc_auc.ci_low.toFixed(3)}–{m.roc_auc.ci_high.toFixed(3)}]
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text font-semibold">
                          {m.pr_auc.value.toFixed(3)}
                          <span className="text-text-tertiary ml-1 text-[11px]">
                            [{m.pr_auc.ci_low.toFixed(3)}–{m.pr_auc.ci_high.toFixed(3)}]
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {m.accuracy ? `${(m.accuracy.value * 100).toFixed(1)}%` : '—'}
                          {m.accuracy && (
                            <span className="text-text-tertiary ml-1 text-[11px]">
                              [{(m.accuracy.ci_low * 100).toFixed(0)}–{(m.accuracy.ci_high * 100).toFixed(0)}%]
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {m.precision ? `${(m.precision.value * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {(m.sensitivity.value * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {(m.specificity.value * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text font-semibold">
                          {m.f1 ? m.f1.value.toFixed(3) : '—'}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {m.brier.value.toFixed(3)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text text-[11px]">
                          {m.confusion_matrix
                            ? `TP:${m.confusion_matrix.tp} FP:${m.confusion_matrix.fp} TN:${m.confusion_matrix.tn} FN:${m.confusion_matrix.fn}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {metrics.roc_curve && metrics.roc_curve.length > 1 && <div className="atlas-roc-widget">
                <div><h3>ROC · actual hold-out predictions</h3><p>ROC-AUC {metrics.test[0].roc_auc.value.toFixed(3)} · 95% CI {metrics.test[0].roc_auc.ci_low.toFixed(3)}–{metrics.test[0].roc_auc.ci_high.toFixed(3)}</p></div>
                <svg viewBox="0 0 420 230" role="img" aria-label="ROC curve calculated from 61 held-out test predictions">
                  <path d="M35 15 V200 H405" fill="none" stroke="#8194a4" strokeWidth="1.5"/>
                  <path d="M35 200 L405 15" stroke="#718397" strokeWidth="1" strokeDasharray="5 5" fill="none"/>
                  <polyline points={metrics.roc_curve.map(p => `${35+p.fpr*370},${200-p.tpr*185}`).join(' ')} fill="none" stroke="#48d9ca" strokeWidth="3.5" strokeLinejoin="round"/>
                  <text x="220" y="225" textAnchor="middle" fill="#dbe6ec" fontSize="12">False positive rate</text>
                  <text x="9" y="114" fill="#dbe6ec" transform="rotate(-90 9 114)" textAnchor="middle" fontSize="12">True positive rate</text>
                </svg>
              </div>}
              {/* Confusion Matrix Highlights */}
              {metrics.test[0]?.confusion_matrix && (
                <div className="pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-2 text-caption">
                  <div className="p-2 bg-surface-alt/60 rounded border border-border">
                    <span className="text-text-tertiary block text-[11px]">True Positives (CAD Identified)</span>
                    <span className="font-mono font-bold text-accent text-body">{metrics.test[0].confusion_matrix.tp}</span>
                  </div>
                  <div className="p-2 bg-surface-alt/60 rounded border border-border">
                    <span className="text-text-tertiary block text-[11px]">True Negatives (Normal Identified)</span>
                    <span className="font-mono font-bold text-success text-body">{metrics.test[0].confusion_matrix.tn}</span>
                  </div>
                  <div className="p-2 bg-surface-alt/60 rounded border border-border">
                    <span className="text-text-tertiary block text-[11px]">False Positives (Type I Error)</span>
                    <span className="font-mono font-bold text-warning text-body">{metrics.test[0].confusion_matrix.fp}</span>
                  </div>
                  <div className="p-2 bg-surface-alt/60 rounded border border-border">
                    <span className="text-text-tertiary block text-[11px]">False Negatives (Type II Error)</span>
                    <span className="font-mono font-bold text-risk-high text-body">{metrics.test[0].confusion_matrix.fn}</span>
                  </div>
                </div>
              )}
            </Panel>
          )}

          {/* TAB 3: CROSS-VALIDATION */}
          {activeTab === 'cv' && metrics && (
            <Panel className="p-4 space-y-3">
              <div className="border-b border-border pb-2">
                <h2 className="text-emphasis font-semibold text-text">5-Fold Stratified Cross-Validation (Training Split, n=242)</h2>
                <p className="text-caption text-text-secondary">
                  Internal stability across 5 stratified folds (mean &plusmn; standard deviation)
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-caption border-collapse">
                  <thead>
                    <tr className="border-b border-border text-text-secondary">
                      <th className="text-left font-semibold py-2">Model Architecture</th>
                      <th className="text-right font-semibold py-2">CV ROC-AUC</th>
                      <th className="text-right font-semibold py-2">CV PR-AUC</th>
                      <th className="text-right font-semibold py-2">CV Accuracy</th>
                      <th className="text-right font-semibold py-2">CV Precision</th>
                      <th className="text-right font-semibold py-2">CV Sensitivity</th>
                      <th className="text-right font-semibold py-2">CV Specificity</th>
                      <th className="text-right font-semibold py-2">CV F1</th>
                      <th className="text-right font-semibold py-2">CV Brier Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {metrics.cv.map((m) => (
                      <tr key={m.name} className="h-10 hover:bg-surface-alt/50">
                        <td className="py-2 text-text font-medium text-body">{m.name}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-text font-semibold">
                          {m.roc_auc.mean.toFixed(3)} &plusmn; {m.roc_auc.std.toFixed(3)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text font-semibold">
                          {m.pr_auc.mean.toFixed(3)} &plusmn; {m.pr_auc.std.toFixed(3)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {m.accuracy ? `${(m.accuracy.mean * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {m.precision ? `${(m.precision.mean * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {m.sensitivity ? `${(m.sensitivity.mean * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {m.specificity ? `${(m.specificity.mean * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text font-semibold">
                          {m.f1 ? m.f1.mean.toFixed(3) : '—'}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {m.brier.mean.toFixed(3)} &plusmn; {m.brier.std.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* TAB 4: CALIBRATION */}
          {activeTab === 'calibration' && metrics && (
            <Panel className="p-4 space-y-4">
              <div className="border-b border-border pb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-emphasis font-semibold text-text">Calibration Reliability Curve</h2>
                  <p className="text-caption text-text-secondary">
                    Mean predicted probability vs observed fraction of positive CAD cases (Platt sigmoid)
                  </p>
                </div>
                <Tag variant="info">Method: {metrics.calibration.method}</Tag>
              </div>

              <div className="atlas-roc-widget"><div><h3>Observed vs predicted · 5 bins</h3><p>Each marker is one nonempty held-out probability bin (n=61). Diagonal represents ideal calibration.</p></div>
                <svg viewBox="0 0 420 230" role="img" aria-label="Calibration curve from held-out predictions">
                  <path d="M35 15 V200 H405" fill="none" stroke="#8194a4" strokeWidth="1.5"/>
                  <path d="M35 200 L405 15" stroke="#718397" strokeWidth="1" strokeDasharray="5 5" fill="none"/>
                  <polyline points={metrics.calibration.bins.filter(b => b.n > 0).map(b => `${35+b.mean_predicted*370},${200-b.fraction_positive*185}`).join(' ')} fill="none" stroke="#ff86a0" strokeWidth="3.5"/>
                  {metrics.calibration.bins.filter(b => b.n > 0).map((b,i) => <circle key={i} cx={35+b.mean_predicted*370} cy={200-b.fraction_positive*185} r={5} fill="#ff86a0"/>)}
                  <text x="220" y="225" textAnchor="middle" fill="#dbe6ec" fontSize="12">Mean predicted probability</text>
                </svg>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-caption border-collapse">
                  <thead>
                    <tr className="border-b border-border text-text-secondary">
                      <th className="text-left font-semibold py-2">Bin Range</th>
                      <th className="text-right font-semibold py-2">Mean Predicted</th>
                      <th className="text-right font-semibold py-2">Fraction Positive</th>
                      <th className="text-right font-semibold py-2">Sample Size (n)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {metrics.calibration.bins.map((b, idx) => (
                      <tr key={idx} className="h-9 hover:bg-surface-alt/50">
                        <td className="py-2 text-text font-medium">Bin {idx + 1}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-text">
                          {(b.mean_predicted * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums font-semibold text-accent">
                          {(b.fraction_positive * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-text-secondary">
                          {b.n} patients
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {activeTab === 'limitations' && <div className="atlas-external-warning"><strong>External cohort evaluation: NOT COMPLETED</strong><p>The Hungarian, Switzerland and VA Long Beach processed datasets were not available in this build environment. A reproducible audit script is provided at <code>backend/external_validation.py</code>. No cross-site performance is claimed.</p></div>}
          {/* TAB 5: LIMITATIONS AND REFERENCES */}
          {activeTab === 'limitations' && metrics && (
            <div className="space-y-6">
              <Panel className="p-4 space-y-3">
                <div className="border-b border-border pb-2">
                  <h2 className="text-emphasis font-semibold text-text">Identified Clinical Limitations</h2>
                  <p className="text-caption text-text-secondary">Known boundary conditions and algorithmic caveats</p>
                </div>
                <ul className="space-y-2 text-caption text-text-secondary list-disc pl-5 leading-relaxed">
                  {metrics.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </Panel>

              <Panel className="p-4 space-y-3 bg-surface-alt/40">
                <div className="border-b border-border pb-2">
                  <h2 className="text-emphasis font-semibold text-text">Primary Scientific References</h2>
                </div>
                <div className="text-caption text-text-secondary space-y-2 leading-relaxed">
                  <p>
                    <strong className="text-text">Primary Citation:</strong> Detrano R, Janosi A, Steinbrunn W, Pfisterer M, Schmid JJ, Sandhu S, Gopalakrishna PX, Belle V. <em>International application of a new probability algorithm for the diagnosis of coronary artery disease.</em> Am J Cardiol 1989;64(5):304–310.
                  </p>
                  <p>
                    <strong className="text-text">Dataset Repository:</strong> UCI Machine Learning Repository: Heart Disease Dataset (Cleveland Clinic Foundation). CC BY 4.0 International License.
                  </p>
                </div>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ModelCardView;
