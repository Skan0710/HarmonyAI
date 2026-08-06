import React from 'react';

interface HighlightTextProps {
  text: string;
  highlight: string;
  className?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  highlight,
  className = '',
}) => {
  if (!highlight || !highlight.trim()) {
    return <span className={className}>{text}</span>;
  }

  const escapedQuery = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span
            key={i}
            className="bg-indigo-500/30 text-indigo-300 font-bold px-1 rounded border border-indigo-500/40"
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
};
