import React from 'react';

type TagVariant = 'default' | 'info' | 'success' | 'warning' | 'error';

interface TagProps {
  variant?: TagVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<TagVariant, string> = {
  default: 'bg-surface-alt text-text-secondary border-border',
  info:    'bg-accent/15 text-accent border-accent/30',
  success: 'bg-risk-low/15 text-risk-low border-risk-low/30',
  warning: 'bg-risk-mod/15 text-risk-mod border-risk-mod/30',
  error:   'bg-risk-vhigh/15 text-risk-vhigh border-risk-vhigh/30',
};

export function Tag({ variant = 'default', children, className = '' }: TagProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full border text-caption font-semibold tracking-normal px-3 py-1',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
