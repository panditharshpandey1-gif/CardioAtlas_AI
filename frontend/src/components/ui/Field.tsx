import React from 'react';

interface FieldProps {
  label: string;
  unit?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function Field({ label, unit, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-caption font-medium text-text-primary flex items-baseline gap-1"
      >
        {label}
        {unit && <span className="text-text-tertiary font-normal">({unit})</span>}
      </label>
      {children}
      {error ? (
        <p className="text-caption text-risk-vhigh">{error}</p>
      ) : hint ? (
        <p className="text-caption text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}
