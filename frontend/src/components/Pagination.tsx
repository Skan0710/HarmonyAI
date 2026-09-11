import React from 'react';
import type { PaginationData } from '../types/music';

interface PaginationProps {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
  limit: number;
  onLimitChange: (limit: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  pagination,
  onPageChange,
  limit,
  onLimitChange,
}) => {
  const { page, pages, total } = pagination;

  if (pages <= 1 && total <= limit) return null;

  const startItem = Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);

  // Generate page numbers range for button rendering
  const getPageNumbers = () => {
    const pageNumbers: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(pages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pageNumbers.push(i);
    }
    return pageNumbers;
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-border-default text-xs">
      {/* Items Range Info & Limit Selector */}
      <div className="flex items-center gap-4 text-text-tertiary">
        <span>
          Showing <span className="font-semibold text-text-primary">{startItem}</span> -{' '}
          <span className="font-semibold text-text-primary">{endItem}</span> of{' '}
          <span className="font-semibold text-text-primary">{total}</span> tracks
        </span>

        <div className="flex items-center gap-1.5 pl-3 border-l border-border-default">
          <span className="text-text-tertiary">Per page:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="bg-surface-2 border border-border-default rounded-[var(--radius-sm)] px-2 py-1 text-text-primary focus:outline-none focus:border-accent"
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Pagination Page Number Buttons */}
      <div className="flex items-center gap-1.5 self-center sm:self-auto">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed text-text-primary rounded-[var(--radius-sm)] font-medium transition-colors border border-border-default flex items-center gap-1 cursor-pointer"
          aria-label="Previous Page"
        >
          ‹ Prev
        </button>

        {getPageNumbers().map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={`w-8 h-8 rounded-[var(--radius-sm)] font-medium transition-all cursor-pointer ${
              pageNum === page
                ? 'bg-accent text-text-on-accent font-semibold shadow-md'
                : 'bg-surface-2 hover:bg-surface-3 text-text-secondary border border-border-default'
            }`}
          >
            {pageNum}
          </button>
        ))}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed text-text-primary rounded-[var(--radius-sm)] font-medium transition-colors border border-border-default flex items-center gap-1 cursor-pointer"
          aria-label="Next Page"
        >
          Next ›
        </button>
      </div>
    </div>
  );
};
