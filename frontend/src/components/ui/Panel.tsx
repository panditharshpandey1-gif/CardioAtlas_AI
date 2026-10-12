import React from 'react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className = '' }: PanelProps) {
  return (
    <div
      className={[
        'premium-panel bg-surface border border-border rounded-lg p-4',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
