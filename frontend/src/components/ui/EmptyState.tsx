import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-12 h-12 rounded bg-surface-alt border border-border flex items-center justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-tertiary">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 8v4m0 4h.01" />
        </svg>
      </div>
      <h3 className="text-emph font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-body text-text-secondary max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
