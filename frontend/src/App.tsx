import React, { useState, useEffect } from 'react';
import { 
  NavigationTab, 
  PatientProfile, 
  PredictionResult, 
  ShapExplanation, 
  PatientData, 
  AssessmentHistoryRecord,
  RiskTier 
} from './types/cardio';
import { 
  apiService, 
  FALLBACK_SAMPLE_PATIENTS 
} from './services/api';
import { AppShell } from './components/layout/AppShell';
import { OverviewView } from './components/views/OverviewView';
import { RiskAssessmentView } from './components/views/RiskAssessmentView';
import { HeartExplorerView } from './components/views/HeartExplorerView';
import { WhatIfLabView } from './components/views/WhatIfLabView';
import { ExplainabilityView } from './components/views/ExplainabilityView';
import { HistoryReportsView } from './components/views/HistoryReportsView';
import { ModelCardView } from './components/views/ModelCardView';
import { UITestView } from './components/views/UITestView';
import { EntryPageView } from './components/views/EntryPageView';
import { DatasetLibraryView } from './components/views/DatasetLibraryView';

export function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    try {
      if (window.location.hash === '#workstation') {
        const saved = localStorage.getItem('cardiovision_active_tab');
        if (saved && ['overview', 'assessment', 'heart', 'whatif', 'explainability', 'history', 'model-card', 'datasets', 'ui-test'].includes(saved)) {
          return saved as NavigationTab;
        }
        return 'overview';
      }
      const hasEntered = sessionStorage.getItem('cardiovision_entered');
      if (hasEntered === 'true') {
        const saved = localStorage.getItem('cardiovision_active_tab');
        if (saved && ['overview', 'assessment', 'heart', 'whatif', 'explainability', 'history', 'model-card', 'datasets', 'ui-test'].includes(saved)) {
          return saved as NavigationTab;
        }
      }
    } catch {}
    return 'entry'; // Show entry page first before entering the main page
  });

  // Handle browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (!window.location.hash || window.location.hash === '' || window.location.hash === '#') {
        try {
          sessionStorage.removeItem('cardiovision_entered');
        } catch {}
        setActiveTab('entry');
      } else if (window.location.hash === '#workstation') {
        try {
          sessionStorage.setItem('cardiovision_entered', 'true');
        } catch {}
        setActiveTab((prev) => (prev === 'entry' ? 'overview' : prev));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('cardiovision_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  const [patients, setPatients] = useState<PatientProfile[]>(FALLBACK_SAMPLE_PATIENTS);
  const [currentPatient, setCurrentPatient] = useState<PatientProfile | null>(FALLBACK_SAMPLE_PATIENTS[0]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [explanation, setExplanation] = useState<ShapExplanation | null>(null);
  const [analysisSnapshot, setAnalysisSnapshot] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedArtery, setSelectedArtery] = useState<'LAD' | 'RCA' | 'LCX' | null>(null);

  // Assessment History Records state
  const [historyRecords, setHistoryRecords] = useState<AssessmentHistoryRecord[]>([
    {
      id: "REC-TC1-01",
      timestamp: "Today, 10:42 AM",
      patientId: "tc-1",
      patientName: "Test case 1",
      patientData: FALLBACK_SAMPLE_PATIENTS[0].data,
      riskScore: 7.8,
      riskTier: "Low" as RiskTier,
      topRiskDriver: "Normal exercise tolerance",
      clinicalNotes: "43-year-old female, test-set row 134.",
      isDemo: true,
    },
    {
      id: "REC-TC2-01",
      timestamp: "Today, 09:15 AM",
      patientId: "tc-2",
      patientName: "Test case 2",
      patientData: FALLBACK_SAMPLE_PATIENTS[1].data,
      riskScore: 26.5,
      riskTier: "Moderate" as RiskTier,
      topRiskDriver: "ST depression (oldpeak)",
      clinicalNotes: "37-year-old male, test-set row 3.",
      isDemo: true,
    },
    {
      id: "REC-TC3-01",
      timestamp: "Yesterday, 04:30 PM",
      patientId: "tc-3",
      patientName: "Test case 3",
      patientData: FALLBACK_SAMPLE_PATIENTS[2].data,
      riskScore: 76.1,
      riskTier: "High" as RiskTier,
      topRiskDriver: "Fluoroscopy vessels (ca)",
      clinicalNotes: "58-year-old male, test-set row 23.",
      isDemo: true,
    }
  ]);

  // Check FastAPI server status and initialize cohort
  useEffect(() => {
    const initApp = async () => {
      try {
        const health = await apiService.checkHealth();
        setBackendOnline(Boolean(health && health.status === 'healthy'));

        const cohort = await apiService.getSamplePatients();
        if (cohort && cohort.length > 0) {
          setPatients(cohort);
          setCurrentPatient(cohort[0]);
        }
      } catch (err) {
        console.warn("Backend initialization fallback:", err);
      }
    };
    initApp();
  }, []);

  // Compute prediction and explanation whenever currentPatient changes
  useEffect(() => {
    let isCancelled = false;
    if (!currentPatient) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setPrediction(null);
          setExplanation(null);
          setAnalysisSnapshot(null);
          setAnalysisError(null);
          setIsLoading(false);
        }
      });
      return () => {
        isCancelled = true;
      };
    }
    const computePatientAnalysis = async () => {
      setIsLoading(true);
      setAnalysisError(null);
      setAnalysisSnapshot(null);
      setPrediction(null);
      setExplanation(null);
      try {
        const [predRes, expRes] = await Promise.all([
          apiService.predict(currentPatient.data),
          apiService.explain(currentPatient.data),
        ]);

        if (!isCancelled) {
          setPrediction(predRes);
          setExplanation(expRes);
          setAnalysisSnapshot(JSON.stringify(currentPatient.data));
          setAnalysisError(null);
        }
      } catch (err) {
        console.error("Patient analysis error:", err);
        if (!isCancelled) {
          setPrediction(null);
          setExplanation(null);
          setAnalysisSnapshot(null);
          setAnalysisError(err instanceof Error ? err.message : 'Backend assessment unavailable');
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    computePatientAnalysis();

    return () => {
      isCancelled = true;
    };
  }, [currentPatient]);

  // Handler for adding a new assessment to history
  const handleSaveToHistory = (record: {
    patientId: string;
    patientName: string;
    patientData: PatientData;
    riskScore: number;
    riskTier: RiskTier;
    confidenceInterval?: [number, number];
    topRiskDriver: string;
    clinicalNotes: string;
    isDemo?: boolean;
  }) => {
    const newEntry: AssessmentHistoryRecord = {
      ...record,
      id: `REC-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setHistoryRecords(prev => [newEntry, ...prev]);
  };

  // Switch to new intake
  const handleNewAssessment = () => {
    setActiveTab('assessment');
  };

  // Re-load demo benchmark history
  const handleLoadDemoHistory = () => {
    setHistoryRecords([
      {
        id: "REC-TC1-01",
        timestamp: "Today, 10:42 AM",
        patientId: "tc-1",
        patientName: "Test case 1",
        patientData: FALLBACK_SAMPLE_PATIENTS[0].data,
        riskScore: 7.8,
        riskTier: "Low" as RiskTier,
        topRiskDriver: "Normal exercise tolerance",
        clinicalNotes: "43-year-old female, test-set row 134.",
        isDemo: true,
      },
      {
        id: "REC-TC2-01",
        timestamp: "Today, 09:15 AM",
        patientId: "tc-2",
        patientName: "Test case 2",
        patientData: FALLBACK_SAMPLE_PATIENTS[1].data,
        riskScore: 26.5,
        riskTier: "Moderate" as RiskTier,
        topRiskDriver: "ST depression (oldpeak)",
        clinicalNotes: "37-year-old male, test-set row 3.",
        isDemo: true,
      },
      {
        id: "REC-TC3-01",
        timestamp: "Yesterday, 04:30 PM",
        patientId: "tc-3",
        patientName: "Test case 3",
        patientData: FALLBACK_SAMPLE_PATIENTS[2].data,
        riskScore: 76.1,
        riskTier: "High" as RiskTier,
        topRiskDriver: "Fluoroscopy vessels (ca)",
        clinicalNotes: "58-year-old male, test-set row 23.",
        isDemo: true,
      }
    ]);
  };

  // When a record is clicked in history, load it as current patient
  const handleSelectHistoryRecord = (record: AssessmentHistoryRecord) => {
    const loadedProfile: PatientProfile = {
      id: record.patientId,
      name: record.patientName,
      age: record.patientData.age,
      sex: record.patientData.sex,
      profile_type: `${record.riskTier} Risk Assessment`,
      clinical_summary: `Archived session from ${record.timestamp}: ${record.clinicalNotes}`,
      data: record.patientData,
      isDemo: record.isDemo,
    };
    setCurrentPatient(loadedProfile);
  };

  // Apply simulated data from What-If lab to patient
  const handleApplySimulatedData = (simulated: PatientData) => {
    if (currentPatient) {
      setCurrentPatient({
        ...currentPatient,
        data: simulated,
        clinical_summary: `Intervention scenario applied. BP: ${simulated.trestbps} mmHg, Chol: ${simulated.chol} mg/dL, HR: ${simulated.thalach} bpm.`,
      });
    }
  };

  const handleEnterWorkstation = (tab: NavigationTab = 'overview') => {
    try {
      sessionStorage.setItem('cardiovision_entered', 'true');
      if (window.location.hash !== '#workstation') {
        window.history.pushState({ tab }, '', '#workstation');
      }
    } catch {}
    setActiveTab(tab);
  };

  const handleSelectPatientAndEnter = (patient: PatientProfile, tab: NavigationTab = 'overview') => {
    setCurrentPatient(patient);
    try {
      sessionStorage.setItem('cardiovision_entered', 'true');
      if (window.location.hash !== '#workstation') {
        window.history.pushState({ tab }, '', '#workstation');
      }
    } catch {}
    setActiveTab(tab);
  };

  const handleBackToEntry = () => {
    try {
      sessionStorage.removeItem('cardiovision_entered');
      if (window.location.hash === '#workstation') {
        window.history.back();
      } else {
        setActiveTab('entry');
      }
    } catch {
      setActiveTab('entry');
    }
  };

  // Dedicated Entry Page before reaching main workstation
  if (activeTab === 'entry') {
    return (
      <EntryPageView
        patients={patients}
        currentPatient={currentPatient}
        backendOnline={backendOnline}
        onEnterWorkstation={handleEnterWorkstation}
        onSelectPatientAndEnter={handleSelectPatientAndEnter}
      />
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      patients={patients}
      selectedPatient={currentPatient}
      onSelectPatient={(p) => setCurrentPatient(p)}
      onNewAssessment={handleNewAssessment}
      backendOnline={backendOnline}
      onBackToEntry={handleBackToEntry}
    >
      {/* VIEW 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <OverviewView
          patient={currentPatient}
          prediction={prediction}
          explanation={explanation}
          selectedArtery={selectedArtery}
          onSelectArtery={setSelectedArtery}
          onStartAssessment={() => setActiveTab('assessment')}
          onExplore3D={() => setActiveTab('heart')}
          onExploreExplainability={() => setActiveTab('explainability')}
          onExploreWhatIf={() => setActiveTab('whatif')}
          onLoadSamplePatient={() => {
            if (patients.length > 0) setCurrentPatient(patients[0]);
          }}
          isLoading={isLoading}
        />
      )}

      {/* VIEW 2: RISK ASSESSMENT */}
      {(activeTab === 'assessment' || activeTab === 'prediction') && (
        <RiskAssessmentView
          currentPatient={currentPatient}
          prediction={prediction}
          onUpdatePatient={(updated) => setCurrentPatient(updated)}
          onNavigateTab={setActiveTab}
          onSaveToHistory={handleSaveToHistory}
        />
      )}

      {/* VIEW 3: 3D HEART EXPLORER */}
      <div style={{ display: activeTab === 'heart' ? 'block' : 'none' }}>
        <HeartExplorerView
          patient={currentPatient}
          patients={patients}
          historyRecords={historyRecords}
          onSelectPatient={setCurrentPatient}
          prediction={analysisSnapshot === JSON.stringify(currentPatient?.data) ? prediction : null}
          explanation={analysisSnapshot === JSON.stringify(currentPatient?.data) ? explanation : null}
          isLoading={isLoading || (Boolean(currentPatient) && analysisSnapshot !== JSON.stringify(currentPatient?.data) && !analysisError)}
          analysisError={analysisError}
          selectedArtery={selectedArtery}
          onSelectArtery={setSelectedArtery}
          onOpenWhatIf={() => setActiveTab('whatif')}
          onOpenAssessment={() => setActiveTab('assessment')}
        />
      </div>

      {/* VIEW 4: WHAT-IF LAB */}
      {activeTab === 'whatif' && (
        <WhatIfLabView
          currentPatient={currentPatient}
          onApplyToPatient={handleApplySimulatedData}
        />
      )}

      {/* VIEW 5: EXPLAINABILITY */}
      {activeTab === 'explainability' && (
        <ExplainabilityView
          explanation={explanation}
          patient={currentPatient}
          onNavigateToWhatIf={() => setActiveTab('whatif')}
          backendOnline={backendOnline}
          isLoading={isLoading}
        />
      )}

      {/* VIEW 6: HISTORY & REPORTS */}
      {activeTab === 'history' && (
        <HistoryReportsView
          historyRecords={historyRecords}
          currentPatient={currentPatient}
          currentPrediction={prediction}
          onSelectRecord={handleSelectHistoryRecord}
          onStartNewAssessment={() => setActiveTab('assessment')}
          onLoadDemoHistory={handleLoadDemoHistory}
        />
      )}

      {/* VIEW 7: MODEL CARD */}
      {activeTab === 'model-card' && (
        <ModelCardView />
      )}

      {activeTab === 'datasets' && <DatasetLibraryView />}

      {/* HIDDEN: UI TEST (for Phase 0 verification) */}
      {(activeTab as string) === 'ui-test' && (
        <UITestView />
      )}
    </AppShell>
  );
}

export default App;
