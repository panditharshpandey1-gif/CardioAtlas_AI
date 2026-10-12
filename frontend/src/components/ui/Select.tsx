import React from 'react';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  options,
  placeholder,
  className = '',
  ...rest
}: SelectProps) {
  return (
    <select
      className={[
        'h-8 w-full px-3 rounded-sm border border-border-strong bg-surface text-body text-text-primary',
        'transition-colors appearance-none cursor-pointer',
        'hover:border-text-tertiary',
        'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M3 5l3 3 3-3%27 stroke=%27%236F6F6F%27 stroke-width=%271.5%27 fill=%27none%27/%3E%3C/svg%3E")]',
        'bg-no-repeat bg-[right_12px_center]',
        className,
      ].join(' ')}
      {...rest}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
