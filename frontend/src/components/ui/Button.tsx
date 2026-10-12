import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white font-semibold hover:bg-accent-hover border border-transparent',
  secondary:
    'bg-transparent text-accent font-medium border border-accent hover:bg-accent-bg',
  tertiary:
    'bg-transparent text-accent font-medium border border-transparent hover:bg-accent-bg',
};

export function Button({
  variant = 'primary',
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 min-h-9 px-4 rounded-lg text-body premium-action',
        'transition-colors cursor-pointer',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        variantClasses[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
}
