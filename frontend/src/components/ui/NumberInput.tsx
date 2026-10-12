import React from 'react';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  unit?: string;
  referenceRange?: string;
}

export function NumberInput({
  unit,
  referenceRange,
  className = '',
  id,
  ...rest
}: NumberInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center">
        <input
          id={id}
          type="number"
          className={[
            'h-8 w-full px-3 rounded-sm border border-border-strong bg-surface text-body text-text-primary',
            'transition-colors placeholder:text-text-tertiary',
            'hover:border-text-tertiary',
            'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
            unit ? 'pr-12' : '',
            className,
          ].join(' ')}
          {...rest}
        />
        {unit && (
          <span className="absolute right-3 text-caption text-text-tertiary pointer-events-none">
            {unit}
          </span>
        )}
      </div>
      {referenceRange && (
        <span className="text-caption text-text-tertiary">Ref: {referenceRange}</span>
      )}
    </div>
  );
}
