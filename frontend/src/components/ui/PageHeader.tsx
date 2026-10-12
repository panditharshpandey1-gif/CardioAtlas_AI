import React from 'react';

interface PageHeaderProps {
  title: string;
  context?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, context, actions }: PageHeaderProps) {
  return (
    <div className="premium-page-header flex items-start justify-between gap-4 mb-6">
      <div>
        <span className="premium-page-kicker">CARDIO ATLAS / RESEARCH WORKSPACE</span>
        <h1 className="text-page font-semibold text-text-primary">{title}</h1>
        {context && (
          <p className="text-body text-text-secondary mt-0.5">{context}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
