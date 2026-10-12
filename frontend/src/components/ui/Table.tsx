import React from 'react';

/* ============================================================
   Dense data table — 36px rows, sticky header, right-aligned numerals.
   ============================================================ */

interface Column<T> {
  key: string;
  header: string;
  /** If true, cell content is right-aligned (for numerals) */
  numeric?: boolean;
  /** Custom cell renderer */
  render?: (row: T, index: number) => React.ReactNode;
  /** Header suffix (e.g. unit) */
  unit?: string;
  /** Column width class */
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Row key accessor */
  rowKey: (row: T, index: number) => string | number;
  /** Callback when a row is clicked */
  onRowClick?: (row: T, index: number) => void;
  /** Empty state message */
  emptyMessage?: string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
}: TableProps<T>) {
  return (
    <div className={`overflow-auto border border-border rounded bg-surface ${className}`}>
      <table className="w-full text-body border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-alt border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  'h-9 px-3 text-caption font-semibold text-text-secondary',
                  col.numeric ? 'text-right' : 'text-left',
                  col.width || '',
                ].join(' ')}
              >
                {col.header}
                {col.unit && (
                  <span className="font-normal text-text-tertiary ml-1">({col.unit})</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="h-20 text-center text-text-tertiary text-body"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                className={[
                  'h-9 border-b border-border last:border-b-0',
                  i % 2 === 1 ? 'bg-surface-alt' : 'bg-surface',
                  onRowClick ? 'cursor-pointer hover:bg-accent-bg transition-colors' : '',
                ].join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-3 text-body',
                      col.numeric ? 'text-right font-mono tabular-nums' : '',
                    ].join(' ')}
                  >
                    {col.render
                      ? col.render(row, i)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
