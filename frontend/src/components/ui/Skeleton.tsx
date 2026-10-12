import React from 'react';

interface SkeletonProps {
  rows?: number;
  className?: string;
}

export function Skeleton({ rows = 3, className = '' }: SkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-9 bg-surface-alt rounded animate-pulse"
          style={{ width: `${100 - i * 8}%` }}
        />
      ))}
    </div>
  );
}
