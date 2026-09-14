import React from 'react';
import StatsCounter from './stats-counter';

interface MeterProps {
  label: string;
  value: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Meter: React.FC<MeterProps> = ({
  label,
  value,
  color = 'var(--accent)',
  size = 'md',
}) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const labelClass = isSm
    ? 'text-xs font-medium text-text-secondary'
    : isLg
    ? 'text-base font-semibold text-text-primary'
    : 'text-sm font-semibold text-text-primary';

  const valueClass = isSm
    ? 'text-xs font-mono text-text-tertiary'
    : isLg
    ? 'text-base font-bold font-mono text-text-secondary'
    : 'text-sm font-bold font-mono text-text-secondary';

  const barHeightClass = isSm ? 'h-1' : isLg ? 'h-2' : 'h-1.5';

  const safeVal = typeof value === 'number' && !isNaN(value) ? value : 0;
  const percent = Math.min(100, Math.max(0, Math.round(safeVal * 100)));

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={labelClass}>{label}</span>
        <span className={valueClass}>
          <StatsCounter value={percent} duration={0.8} suffix="%" />
        </span>
      </div>
      <div className={`${barHeightClass} rounded-full bg-surface-2 overflow-hidden`}>
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
};
