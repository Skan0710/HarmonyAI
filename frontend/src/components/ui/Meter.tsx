import React from 'react';
import StatsCounter from './stats-counter';

interface MeterProps {
  label: string;
  value: number;
  color?: string;
}

export const Meter: React.FC<MeterProps> = ({ label, value, color = 'var(--accent)' }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <span className="text-xs font-mono text-text-tertiary">
        <StatsCounter value={Math.round(value * 100)} duration={1} suffix="%" />
      </span>
    </div>
    <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-out"
        style={{ width: `${Math.round(value * 100)}%`, background: color }}
      />
    </div>
  </div>
);
