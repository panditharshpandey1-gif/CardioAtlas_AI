import React from 'react';

interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      className={[
        'inline-flex items-center rounded-sm border border-border bg-surface-alt p-0.5 gap-0.5',
        className,
      ].join(' ')}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={[
              'px-3 h-7 text-caption font-medium rounded-full transition-colors cursor-pointer',
              isActive
                ? 'bg-surface text-text-primary shadow-sm border border-border'
                : 'text-text-tertiary hover:text-text-secondary border border-transparent',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
