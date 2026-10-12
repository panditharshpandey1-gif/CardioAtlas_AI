import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, Check, CircleDot, Database,
  Eye, HeartPulse, Info, Layers3, Radar, ScanHeart, ShieldCheck, SlidersHorizontal,
  Sparkles, UserRound, Waves,
} from 'lucide-react';
import type {
  AssessmentHistoryRecord, PatientProfile, PredictionResult, ShapExplanation,
} from '../../types/cardio';
import { CORONARY_ARTERY_DETAILS } from '../../services/api';
import { buildClinicalSignals } from '../../features/heart-intelligence/clinicalSignals';
import type { ClinicalSignalId } from '../../features/heart-intelligence/clinicalSignals';
import { HeartViewer3D } from '../heart/HeartViewer3D';

type Artery = 'LAD' | 'RCA' | 'LCX';
interface Props {
  patient: PatientProfile | null;
  patients: PatientProfile[];
  historyRecords: AssessmentHistoryRecord[];
  onSelectPatient: (patient: PatientProfile) => void;
  prediction: PredictionResult | null;
  explanation: ShapExplanation | null;
  isLoading: boolean;
  analysisError: string | null;
  selectedArtery: Artery | null;
  onSelectArtery: (artery: Artery | null) => void;
  onOpenWhatIf: () => void;
  onOpenAssessment: () => void;
}

const structures = [
  { id: 'LAD', label: 'LAD', name: 'Left anterior descending' },
  { id: 'RCA', label: 'RCA', name: 'Right coronary artery' },
  { id: 'LCX', label: 'LCX', name: 'Left circumflex artery' },
] as const;

export function HeartExplorerView({
  patient, patients, historyRecords, onSelectPatient, prediction, explanation, isLoading,
  analysisError, selectedArtery, onSelectArtery, onOpenWhatIf, onOpenAssessment,
}: Props) {
  const [inspectorTab, setInspectorTab] = useState<'signals' | 'anatomy'>('signals');
  const [selectedSignalId, setSelectedSignalId] = useState<ClinicalSignalId | null>(null);
  const [signalOverlayOn, setSignalOverlayOn] = useState(true);
  const signals = useMemo(() => patient ? buildClinicalSignals(patient.data, explanation) : [], [patient, explanation]);
  const emphasizedSignals = signals.filter(signal => signal.flagged);
  const selectedSignal = signals.find(signal => signal.id === selectedSignalId) ?? emphasizedSignals[0] ?? signals[0];
  const selectedStructure = selectedArtery ? CORONARY_ARTERY_DETAILS[selectedArtery] : null;
  const modelScore = prediction?.risk_score ?? null;

  useEffect(() => {
    setSelectedSignalId(null);
  }, [patient?.id, patient?.data]);

  const cases = useMemo(() => [
    ...patients.map(p => ({ key: `cohort:${p.id}`, label: `${p.name} · dataset case`, patient: p })),
    ...historyRecords.filter(r => !r.isDemo).map(record => ({
      key: `history:${record.id}`,
      label: `${record.patientName} · saved assessment`,
      patient: {
        id: `record-${record.id}`, name: record.patientName, data: record.patientData,
        clinical_summary: `Saved assessment from ${record.timestamp}. ${record.clinicalNotes}`,
        isDemo: false,
      } as PatientProfile,
    })),
  ], [patients, historyRecords]);
  const caseValue = cases.find(c => c.patient.id === patient?.id && JSON.stringify(c.patient.data) === JSON.stringify(patient?.data))?.key ?? '';

  return <div className="heart-intel-page">
    <div className="heart-intel-kicker"><Sparkles size={15}/> CARDIO ATLAS / PATIENT DIGITAL EXPLORER <span>V2.0 RESEARCH WORKSPACE</span></div>
    <div className="heart-intel-heading">
      <div>
        <span className="heart-intel-eyebrow">THE NEXT DIMENSION OF EXPLAINABLE AI</span>
        <h1>See the data. <em>Explore the heart.</em></h1>
        <p>Patient records drive an interactive 3D signal map. Inspect real input values, model explanations and anatomical reference structures together.</p>
      </div>
      <div className="heart-intel-mode-pill"><span/> INTERACTIVE PATIENT-LINKED VIEW <ArrowUpRight size={17}/></div>
    </div>

    <div className="heart-intel-layout">
      <aside className="heart-intel-left">
        <div className="heart-intel-section-kicker"><UserRound size={15}/> PATIENT CONTEXT <span>01 / INPUT</span></div>
        <div className="heart-intel-case-intro"><span className="heart-intel-avatar"><HeartPulse size={26}/></span><div><span>ACTIVE RECORD</span><strong>{patient?.name ?? 'No patient selected'}</strong><small>{patient?.id ?? '—'}</small></div></div>
        <label htmlFor="heart-case-picker" className="heart-intel-field-label">SWITCH PATIENT RECORD</label>
        <div className="heart-intel-select-wrap">
          <select id="heart-case-picker" value={caseValue} onChange={event => {
            const chosen = cases.find(c => c.key === event.target.value);
            if (chosen) onSelectPatient(chosen.patient);
          }}>
            {!caseValue && <option value="">Current custom assessment</option>}
            {cases.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        {patient ? <>
          <div className="heart-intel-patient-caption"><Database size={13}/> {patient.isDemo ? 'DEIDENTIFIED UCI TEST CASE' : 'CURRENT ASSESSMENT'} <span>13 INPUTS</span></div>
          <div className="heart-intel-vitals">
            <div><span>AGE</span><strong>{patient.data.age} <small>yrs</small></strong></div>
            <div><span>SEX CODE</span><strong>{patient.data.sex === 1 ? 'Male' : 'Female'}</strong></div>
            <div><span>SYSTOLIC BP</span><strong>{patient.data.trestbps} <small>mmHg</small></strong></div>
            <div><span>CHOLESTEROL</span><strong>{patient.data.chol} <small>mg/dL</small></strong></div>
            <div><span>MAX EXERCISE HR</span><strong>{patient.data.thalach} <small>bpm</small></strong></div>
            <div><span>ST DEPRESSION</span><strong>{patient.data.oldpeak} <small>mm</small></strong></div>
          </div>
          <div className="heart-intel-data-status"><span className="heart-intel-data-orb"/> Data synchronized with 3D callouts <Check size={14}/></div>
        </> : <div className="heart-intel-empty">Choose a record to explore its values.</div>}
        <button type="button" className="heart-intel-outline-btn" onClick={onOpenAssessment}><SlidersHorizontal size={17}/> Edit / enter new values <ArrowRight size={16}/></button>
        <div className="heart-intel-left-note"><Info size={17}/><span>Records drive <strong>schematic clinical signal markers</strong> on reference anatomy—not a reconstructed patient heart.</span></div>
      </aside>

      <section className="heart-intel-stage">
        <div className="heart-intel-stage-top"><span><span className="heart-intel-live-dot"/> LIVE 3D REFERENCE CANVAS</span><span>DRAG TO ROTATE · SCROLL TO ZOOM</span></div>
        <div className="heart-intel-stage-masthead"><div><span>HEART INTELLIGENCE</span><strong>{patient?.name ?? 'Reference mode'}</strong></div><span className="heart-intel-index">01 <i/> 03</span></div>
        <div className="heart-intel-viewer-shell">
          <div className="heart-intel-stage-aura" aria-hidden="true"/>
          <HeartViewer3D
            className="heart-intel-3d"
            initialArtery={selectedArtery}
            onArterySelect={onSelectArtery}
            clinicalSignals={signals}
            selectedSignalId={selectedSignal?.id ?? null}
            onSignalSelect={id => { setSelectedSignalId(id); setInspectorTab('signals'); }}
            showSignalOverlay={inspectorTab === 'signals' && signalOverlayOn && Boolean(patient)}
            modelScore={modelScore}
          />
        </div>
        <div className="heart-intel-overlay-controls">
          <button type="button" className={inspectorTab === 'signals' && signalOverlayOn ? 'selected' : ''}
            onClick={() => { setInspectorTab('signals'); setSignalOverlayOn(v => !v); }} aria-pressed={inspectorTab === 'signals' && signalOverlayOn}>
            <Radar size={16}/> {inspectorTab === 'signals' && signalOverlayOn ? 'Signal overlay ON' : 'Signal overlay OFF'}
          </button>
          <span><span className="heart-intel-warn-dot"/> Highlighted = heuristic data flag</span>
        </div>
        <div className="heart-intel-stage-disclaimer"><ShieldCheck size={16}/> Callout positions are schematic. No patient-specific lesion, blockage, or tissue damage is identified.</div>
      </section>

      <aside className="heart-intel-right">
        <div className="heart-intel-right-heading"><span><Activity size={15}/> MODEL INTERPRETATION</span><span>02 / INSIGHT</span></div>
        <div className="heart-intel-score-box">
          <span>HEART DISEASE CLASSIFICATION</span>
          {isLoading ? <><strong className="heart-intel-score-muted">…</strong><p>Calculating model output</p></>
            : modelScore == null ? <><strong className="heart-intel-score-muted">—</strong><p>Model output unavailable</p></>
              : <><div className="heart-intel-score-line"><strong>{modelScore.toFixed(1)}<small>%</small></strong><span className={`heart-intel-band ${modelScore >= 66 ? 'high' : modelScore >= 33 ? 'medium' : 'low'}`}>{prediction?.risk_tier}</span></div><div className="heart-intel-score-meter"><span style={{width:`${Math.min(100, Math.max(0, modelScore))}%`}}/></div><p>Model class probability (research only), not predicted chance of a heart attack.</p></>}
          {analysisError && !isLoading && <div className="heart-intel-failure"><AlertCircle size={15}/> {analysisError}</div>}
        </div>
        <div className="heart-intel-inspector-tabs">
          <button type="button" onClick={() => setInspectorTab('signals')} className={inspectorTab === 'signals' ? 'active' : ''}><Radar size={15}/> Data signals</button>
          <button type="button" onClick={() => setInspectorTab('anatomy')} className={inspectorTab === 'anatomy' ? 'active' : ''}><Layers3 size={15}/> Anatomy</button>
        </div>
        {inspectorTab === 'signals' ? <div className="heart-intel-inspect-scroll">
          <div className="heart-intel-list-header"><span>CLINICAL DATA OVERLAY</span><strong>{emphasizedSignals.length} highlighted</strong></div>
          <div className="heart-intel-signals-list">{signals.map(signal => <button
            type="button" key={signal.id}
            onClick={() => setSelectedSignalId(signal.id)}
            className={`heart-intel-signal-row ${signal.flagged ? 'flagged' : ''} ${selectedSignal?.id === signal.id ? 'active' : ''}`}
          ><i/><span><strong>{signal.label}</strong><small>{signal.flagged ? 'SPOTLIGHTED INPUT' : 'CONTEXTUAL INPUT'}{signal.isPositiveModelInfluence ? ' · POSITIVE MODEL INFLUENCE' : ''}</small></span><b>{signal.reading}</b></button>)}</div>
          {selectedSignal && <div className="heart-intel-detail"><div className="heart-intel-detail-head"><CircleDot size={15}/> SELECTED DATA SIGNAL</div><h3>{selectedSignal.label}</h3><div className="heart-intel-detail-value">{selectedSignal.reading}</div><p>{selectedSignal.note}</p><small>{selectedSignal.trigger}</small></div>}
        </div> : <div className="heart-intel-inspect-scroll">
          <div className="heart-intel-list-header"><span>REFERENCE ANATOMY</span><strong>3 regions</strong></div>
          <div className="heart-intel-anatomy-list">{structures.map(s => <button type="button" key={s.id} onClick={() => onSelectArtery(s.id)} className={selectedArtery === s.id ? 'active' : ''}><span>{s.label}</span>{s.name}<ArrowRight size={15}/></button>)}</div>
          <div className="heart-intel-detail"><div className="heart-intel-detail-head"><Eye size={15}/> STRUCTURE NOTES</div><h3>{selectedStructure?.name ?? 'Select an anatomical region'}</h3><p>{selectedStructure?.description ?? 'Choose LAD, RCA or LCX to orient the camera and read a generic anatomical explanation.'}</p></div>
        </div>}
        <div className="heart-intel-interpretation-foot"><Waves size={16}/><span>Explainable AI, not coronary imaging or a diagnostic decision.</span></div>
      </aside>
    </div>

    <div className="heart-intel-bottom">
      <div className="heart-intel-bottom-intro"><span>03 / REASONING</span><h2>What drives <em>the model?</em></h2><p>Genuine backend explanations, not invented visual findings.</p></div>
      <div className="heart-intel-driver-list">{isLoading ? <div className="heart-intel-driver-empty">Computing feature contributions…</div>
        : explanation?.top_risk_drivers?.length ? explanation.top_risk_drivers.slice(0, 3).map((driver, i) => <div key={`${driver.feature}-${i}`} className="heart-intel-driver"><span>0{i+1}</span><div><strong>{driver.label}</strong><small>Value: {driver.patient_value} · increases model output</small></div><ArrowUpRight size={17}/></div>)
        : <div className="heart-intel-driver-empty">{analysisError ? 'Model explanations could not be loaded.' : 'No positive-driving features returned by the model.'}</div>}
      </div>
      <button type="button" className="heart-intel-whatif-btn" onClick={onOpenWhatIf}><span>EXPLORE A SCENARIO</span><strong>What if the inputs change?</strong><small>Compare fresh model outputs. No treatment-effect prediction.</small><ArrowRight size={19}/></button>
    </div>
    <div className="heart-intel-legal"><ShieldCheck size={17}/> EDUCATIONAL RESEARCH PROTOTYPE <span/> UCI CLEVELAND CLINICAL FEATURES · NOT MEDICAL ADVICE · NO PATIENT-SPECIFIC CORONARY IMAGING</div>
  </div>;
}
