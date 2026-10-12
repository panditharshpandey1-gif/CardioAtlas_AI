import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-12 h-12 rounded bg-risk-vhigh/15 border border-risk-vhigh/30 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-risk-vhigh" />
      </div>
      <h3 className="text-emph font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-body text-text-secondary max-w-sm">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
