import React, { useState } from 'react';
import {
  Button,
  Field,
  NumberInput,
  Select,
  SegmentedControl,
  Tag,
  Table,
  Panel,
  PageHeader,
  SectionHeading,
  Banner,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../ui';

/**
 * UI primitives test page — hidden tab for Phase 0 verification.
 * Displays all design system components with correct tokens.
 */
export function UITestView() {
  const [segment, setSegment] = useState('a');
  const [numVal, setNumVal] = useState('120');

  const sampleTableData = [
    { id: 1, name: 'Age', value: 62, unit: 'years', ref: '18–100' },
    { id: 2, name: 'Resting BP', value: 164, unit: 'mmHg', ref: '90–140' },
    { id: 3, name: 'Cholesterol', value: 288, unit: 'mg/dL', ref: '<200' },
    { id: 4, name: 'Max HR', value: 122, unit: 'bpm', ref: '60–200' },
    { id: 5, name: 'ST depression', value: 2.6, unit: 'mm', ref: '0–2' },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="UI primitives"
        context="Phase 0 design system verification — all tokens and components"
      />

      {/* Banners */}
      <section>
        <SectionHeading title="Banners" />
        <div className="space-y-2">
          <Banner variant="warning">
            <span className="font-medium">Backend unreachable</span> — showing offline approximation.
          </Banner>
          <Banner variant="info">
            All models loaded and calibrated. Ready for assessment.
          </Banner>
        </div>
      </section>

      {/* Tags */}
      <section>
        <SectionHeading title="Tags" />
        <div className="flex flex-wrap gap-2">
          <Tag>Default</Tag>
          <Tag variant="info">Info</Tag>
          <Tag variant="success">Low risk</Tag>
          <Tag variant="warning">Moderate</Tag>
          <Tag variant="error">Very high</Tag>
        </div>
      </section>

      {/* Buttons */}
      <section>
        <SectionHeading title="Buttons" />
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Calculate</Button>
          <Button variant="secondary">Export</Button>
          <Button variant="tertiary">Cancel</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>

      {/* Form controls */}
      <section>
        <SectionHeading title="Form controls" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          <Field label="Resting blood pressure" unit="mmHg" hint="Normal: 90–120">
            <NumberInput
              unit="mmHg"
              value={numVal}
              onChange={(e) => setNumVal(e.target.value)}
              referenceRange="90–120"
            />
          </Field>

          <Field label="Chest pain type">
            <Select
              options={[
                { value: 0, label: 'Typical angina' },
                { value: 1, label: 'Atypical angina' },
                { value: 2, label: 'Non-anginal' },
                { value: 3, label: 'Asymptomatic' },
              ]}
              defaultValue={0}
            />
          </Field>

          <Field label="Exercise angina" error="Required field">
            <Select
              options={[
                { value: 0, label: 'No' },
                { value: 1, label: 'Yes' },
              ]}
              placeholder="Select..."
            />
          </Field>
        </div>
      </section>

      {/* Segmented control */}
      <section>
        <SectionHeading title="Segmented control" />
        <SegmentedControl
          options={[
            { value: 'a', label: 'Ensemble' },
            { value: 'b', label: 'Gradient boosting' },
            { value: 'c', label: 'Random forest' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </section>

      {/* Table */}
      <section>
        <SectionHeading title="Dense data table" />
        <Table
          columns={[
            { key: 'name', header: 'Parameter' },
            { key: 'value', header: 'Value', numeric: true },
            { key: 'unit', header: 'Unit' },
            { key: 'ref', header: 'Reference' },
          ]}
          data={sampleTableData}
          rowKey={(row) => row.id}
        />
      </section>

      {/* Panel */}
      <section>
        <SectionHeading title="Panel" />
        <Panel>
          <p className="text-body text-text-secondary">
            A white surface panel with 1px hairline border, 4px radius, no shadows.
            Used for independent content blocks.
          </p>
        </Panel>
      </section>

      {/* Skeleton */}
      <section>
        <SectionHeading title="Loading skeleton" />
        <Panel>
          <Skeleton rows={4} />
        </Panel>
      </section>

      {/* States */}
      <section>
        <SectionHeading title="Empty & error states" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Panel>
            <EmptyState
              title="No assessments yet"
              description="Run a risk assessment to see results here."
              action={<Button variant="secondary">Start assessment</Button>}
            />
          </Panel>
          <Panel>
            <ErrorState
              message="Could not load model metrics from the backend."
              onRetry={() => alert('Retry clicked')}
            />
          </Panel>
        </div>
      </section>

      {/* Color tokens */}
      <section>
        <SectionHeading title="Color tokens" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: '--canvas', cls: 'bg-canvas border' },
            { name: '--surface', cls: 'bg-surface border' },
            { name: '--surface-alt', cls: 'bg-surface-alt border' },
            { name: '--accent', cls: 'bg-accent text-white' },
            { name: '--accent-bg', cls: 'bg-accent-bg border' },
            { name: '--risk-low', cls: 'bg-risk-low text-white' },
            { name: '--risk-mod', cls: 'bg-risk-mod text-white' },
            { name: '--risk-high', cls: 'bg-risk-high text-white' },
            { name: '--risk-vhigh', cls: 'bg-risk-vhigh text-white' },
            { name: '--viewport-bg', cls: 'bg-viewport-bg text-white' },
          ].map((t) => (
            <div key={t.name} className={`rounded p-3 text-caption font-mono ${t.cls} border-border`}>
              {t.name}
            </div>
          ))}
        </div>
      </section>

      {/* Typography scale */}
      <section>
        <SectionHeading title="Typography scale" />
        <div className="space-y-2">
          <div className="text-result font-mono font-semibold text-text-primary">40/44 — Result numeral</div>
          <div className="text-page font-semibold text-text-primary">28/36 — Page title</div>
          <div className="text-section font-semibold text-text-primary">20/28 — Section title</div>
          <div className="text-emph font-medium text-text-primary">16/24 — Emphasis</div>
          <div className="text-body text-text-primary">14/20 — Body text</div>
          <div className="text-caption text-text-tertiary">12/16 — Caption / helper</div>
        </div>
      </section>

      {/* Focus ring demo */}
      <section>
        <SectionHeading title="Focus ring (tab through)" />
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-surface border border-border rounded-sm text-body cursor-pointer">
            Tab to me
          </button>
          <a href="#" className="px-4 py-2 text-accent text-body underline">
            Link element
          </a>
          <input
            type="text"
            placeholder="Text input"
            className="h-8 px-3 rounded-sm border border-border-strong text-body bg-surface"
          />
        </div>
      </section>
    </div>
  );
}
