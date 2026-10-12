import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

type BannerVariant = 'warning' | 'info';

interface BannerProps {
  variant?: BannerVariant;
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const config: Record<BannerVariant, { bg: string; border: string; text: string; Icon: typeof AlertTriangle }> = {
  warning: {
    bg: 'bg-risk-mod/15',
    border: 'border-risk-mod/40',
    text: 'text-risk-mod',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-accent/15',
    border: 'border-accent/40',
    text: 'text-accent',
    Icon: Info,
  },
};

export function Banner({ variant = 'warning', children, className = '', onDismiss }: BannerProps) {
  const { bg, border, text, Icon } = config[variant];
  return (
    <div
      role="status"
      className={[
        'flex items-start gap-2 px-4 py-2.5 border rounded text-body',
        bg, border, text,
        className,
      ].join(' ')}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-text-tertiary hover:text-text-primary text-caption cursor-pointer"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
