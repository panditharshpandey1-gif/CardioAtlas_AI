import React from 'react';

interface SectionHeadingProps {
  title: string;
  className?: string;
}

export function SectionHeading({ title, className = '' }: SectionHeadingProps) {
  return (
    <div className={`premium-section-heading border-b border-border pb-3 mb-4 ${className}`}>
      <h2 className="text-section font-semibold text-text-primary">{title}</h2>
    </div>
  );
}
