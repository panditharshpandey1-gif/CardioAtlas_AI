import React, { useState } from 'react';
import { 
  AssessmentHistoryRecord, 
  PatientProfile, 
  PredictionResult 
} from '../../types/cardio';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { Tag } from '../ui/Tag';
import { Button } from '../ui/Button';
import { 
  Printer, 
  ArrowLeft, 
  Download, 
  Search, 
  Plus, 
  FileText
} from 'lucide-react';

interface HistoryReportsViewProps {
  historyRecords: AssessmentHistoryRecord[];
  currentPatient: PatientProfile | null;
  currentPrediction: PredictionResult | null;
  onSelectRecord: (record: AssessmentHistoryRecord) => void;
  onStartNewAssessment: () => void;
  onLoadDemoHistory: () => void;
}

export function HistoryReportsView({
  historyRecords,
  onSelectRecord,
  onStartNewAssessment,
}: HistoryReportsViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [activeReport, setActiveReport] = useState<AssessmentHistoryRecord | null>(null);

  // Filter history records
  const filteredRecords = historyRecords.filter((rec) => {
    const matchesSearch = 
      rec.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.patientId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = selectedTier === 'All' || rec.riskTier === selectedTier;
    return matchesSearch && matchesTier;
  });

  const getTierTagVariant = (tier: string) => {
    switch (tier) {
      case 'Low': return 'success';
      case 'Moderate': return 'warning';
      case 'High': return 'warning';
      case 'Very high':
      case 'Critical': return 'error';
      default: return 'default';
    }
  };

  const handleExportJson = (record: AssessmentHistoryRecord) => {
    const exportPayload = {
      product: "Cardio Atlas AI",
      reportType: "Research Classification Summary",
      generatedAt: new Date().toISOString(),
      recordId: record.id,
      patient: {
        id: record.patientId,
        name: record.patientName,
        parameters: record.patientData,
      },
      assessment: {
        riskScore: record.riskScore,
        riskTier: record.riskTier,
        topRiskDriver: record.topRiskDriver,
        clinicalNotes: record.clinicalNotes,
      },
      disclaimer: "Research and educational prototype. Not a diagnostic device."
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CardioAtlas_Report_${record.patientId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // IF REPORT VIEW IS ACTIVE: Show the print-ready report with "Back to history"
  if (activeReport) {
    return (
      <div className="space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between no-print">
          <Button
            variant="secondary"
            onClick={() => setActiveReport(null)}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Back to history
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => handleExportJson(activeReport)}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export JSON
            </Button>
            <Button
              variant="primary"
              onClick={() => window.print()}
              icon={<Printer className="w-3.5 h-3.5" />}
            >
              Print A4 report
            </Button>
          </div>
        </div>

        {/* Report Document Sheet (A4 printable styling) */}
        <div className="max-w-3xl mx-auto bg-surface border border-border rounded p-8 space-y-6 shadow-sm print:border-none print:shadow-none print:p-0">
          {/* Header */}
          <div className="border-b border-border pb-4 flex items-start justify-between">
            <div>
              <span className="text-caption font-semibold uppercase tracking-wider text-accent block">
                Cardio Atlas AI &bull; Cardiovascular Research Workspace
              </span>
              <h1 className="text-page font-semibold text-text mt-1">
                Cardiovascular Research Assessment Summary
              </h1>
              <p className="text-caption text-text-secondary mt-0.5">
                Record ID: {activeReport.id} &bull; Timestamp: {activeReport.timestamp}
              </p>
            </div>
            <Tag variant="info">UCI Cleveland (n=303)</Tag>
          </div>

          {/* Patient Details */}
          <div className="grid grid-cols-3 gap-4 p-4 rounded-xs bg-surface-alt/50 border border-border text-caption">
            <div>
              <span className="text-text-tertiary block">Subject Name / ID</span>
              <span className="text-body font-semibold text-text">{activeReport.patientName}</span>
            </div>
            <div>
              <span className="text-text-tertiary block">Demographics</span>
              <span className="text-body font-medium text-text">
                {activeReport.patientData.age} years, {activeReport.patientData.sex === 1 ? 'Male' : 'Female'}
              </span>
            </div>
            <div>
              <span className="text-text-tertiary block">Assigned Risk Band</span>
              <Tag variant={getTierTagVariant(activeReport.riskTier) as any} className="mt-0.5">
                {activeReport.riskTier}
              </Tag>
            </div>
          </div>

          {/* Calibrated Model Score */}
          <div className="p-4 rounded-xs border border-border bg-surface-alt/30 flex items-center justify-between">
            <div>
              <span className="text-caption text-text-secondary block">Calibrated Model Score</span>
              <div className="text-result font-mono font-semibold text-text">
                {activeReport.riskScore.toFixed(1)}%
              </div>
              <span className="text-caption text-text-tertiary">
                Unweighted consensus of 3 calibrated classifiers
              </span>
            </div>

            <div className="text-right">
              <span className="text-caption text-text-secondary block">Primary Risk Factor</span>
              <span className="text-emphasis font-semibold text-text">
                {activeReport.topRiskDriver || 'Exercise ST depression'}
              </span>
            </div>
          </div>

          {/* Key Biomarkers Table */}
          <div>
            <h3 className="text-emphasis font-semibold text-text mb-2">Recorded Intake Biomarkers</h3>
            <div className="overflow-x-auto border border-border rounded-xs">
              <table className="w-full text-caption border-collapse">
                <thead className="bg-surface-alt text-text-secondary border-b border-border">
                  <tr>
                    <th className="py-2 px-3 text-left font-semibold">Parameter</th>
                    <th className="py-2 px-3 text-right font-semibold">Observed Value</th>
                    <th className="py-2 px-3 text-left font-semibold pl-4">Clinical Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-1.5 px-3 font-medium text-text">Resting blood pressure (trestbps)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold">{activeReport.patientData.trestbps} mmHg</td>
                    <td className="py-1.5 px-3 pl-4 text-text-secondary">&lt; 120 mmHg</td>
                  </tr>
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-1.5 px-3 font-medium text-text">Serum cholesterol (chol)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold">{activeReport.patientData.chol} mg/dL</td>
                    <td className="py-1.5 px-3 pl-4 text-text-secondary">&lt; 200 mg/dL</td>
                  </tr>
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-1.5 px-3 font-medium text-text">Max heart rate (thalach)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold">{activeReport.patientData.thalach} bpm</td>
                    <td className="py-1.5 px-3 pl-4 text-text-secondary">130–185 bpm</td>
                  </tr>
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-1.5 px-3 font-medium text-text">ST depression (oldpeak)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold">{activeReport.patientData.oldpeak.toFixed(1)} mm</td>
                    <td className="py-1.5 px-3 pl-4 text-text-secondary">&lt; 1.0 mm</td>
                  </tr>
                  <tr className="hover:bg-surface-alt/40">
                    <td className="py-1.5 px-3 font-medium text-text">Major vessels (ca)</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold">{activeReport.patientData.ca} vessels</td>
                    <td className="py-1.5 px-3 pl-4 text-text-secondary">0 vessels</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Clinical Interpretation Notes */}
          <div className="p-3.5 rounded-xs border border-border bg-surface-alt/40 space-y-1 text-caption">
            <span className="font-semibold text-text block">Clinical Assessment Note:</span>
            <p className="text-text-secondary leading-relaxed">
              {activeReport.clinicalNotes}
            </p>
          </div>

          {/* Mandatory Disclaimer Footer */}
          <div className="pt-4 border-t border-border text-caption text-text-tertiary space-y-1">
            <p className="font-semibold text-text-secondary">
              Research & Educational Prototype Notice:
            </p>
            <p className="leading-relaxed">
              This report is generated for investigational and educational demonstration only. Cardio Atlas AI is not a diagnostic medical device and must not replace professional clinical evaluation or coronary catheterization imaging.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT VIEW: Show the History Table Only!
  return (
    <div className="space-y-6">
      {/* 1. Page Header (24px gap before content) */}
      <PageHeader
        title="Assessment History"
        context="Audit ledger of past risk evaluations and clinical summary reports"
        actions={
          <Button
            variant="primary"
            onClick={onStartNewAssessment}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            New intake
          </Button>
        }
      />

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded bg-surface border border-border">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by case name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-body bg-surface-alt border border-border rounded-xs text-text placeholder:text-text-tertiary focus:outline-none focus:border-accent"
          />
        </div>

        {/* Tier filter buttons */}
        <div className="flex items-center gap-1 text-caption">
          <span className="text-text-secondary font-medium mr-1">Band:</span>
          {['All', 'Low', 'Moderate', 'High', 'Very high'].map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setSelectedTier(tier)}
              className={`px-2.5 py-1 rounded-xs border transition-colors cursor-pointer ${
                selectedTier === tier
                  ? 'bg-accent/15 border-accent text-accent font-semibold'
                  : 'bg-surface border-border text-text-secondary hover:text-text'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* 3. History Table (Row click opens the report!) */}
      <Panel className="p-4 space-y-3">
        <div className="border-b border-border pb-2 flex items-center justify-between">
          <h2 className="text-emphasis font-semibold text-text">Archived Assessment Sessions</h2>
          <span className="text-caption text-text-tertiary">
            Click any row to open the print-ready clinical report
          </span>
        </div>

        {filteredRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-body border-collapse">
              <thead>
                <tr className="border-b border-border text-caption text-text-secondary">
                  <th className="text-left font-semibold py-2">Timestamp</th>
                  <th className="text-left font-semibold py-2">Case / Subject</th>
                  <th className="text-right font-semibold py-2">Model Score</th>
                  <th className="text-center font-semibold py-2">Assigned Band</th>
                  <th className="text-left font-semibold py-2 pl-4">Primary Driver</th>
                  <th className="text-right font-semibold py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => {
                      setActiveReport(rec);
                      onSelectRecord(rec);
                    }}
                    className="h-10 hover:bg-surface-alt/60 cursor-pointer transition-colors"
                  >
                    <td className="py-2 text-caption text-text-secondary font-mono">
                      {rec.timestamp}
                    </td>
                    <td className="py-2 text-text font-medium">
                      {rec.patientName}
                      <span className="text-text-tertiary text-caption font-mono ml-1.5">
                        ({rec.patientId})
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono font-semibold tabular-nums text-text">
                      {rec.riskScore.toFixed(1)}%
                    </td>
                    <td className="py-2 text-center">
                      <Tag variant={getTierTagVariant(rec.riskTier) as any}>
                        {rec.riskTier}
                      </Tag>
                    </td>
                    <td className="py-2 pl-4 text-caption text-text-secondary">
                      {rec.topRiskDriver || 'Exercise ST depression'}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant="secondary"
                        className="text-caption h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReport(rec);
                          onSelectRecord(rec);
                        }}
                        icon={<FileText className="w-3.5 h-3.5" />}
                      >
                        Open report &rarr;
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-caption text-text-tertiary">
            No assessment records match the current filter.
          </div>
        )}
      </Panel>
    </div>
  );
}

export default HistoryReportsView;
