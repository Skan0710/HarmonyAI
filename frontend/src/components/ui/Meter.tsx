import React from 'react';

interface MeterProps {
  label: string;
  value: number;
  color?: string;
}

export const Meter: React.FC<MeterProps> = ({ label, value, color = 'var(--accent)' }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <span className="text-xs font-mono text-text-tertiary tabular-nums">{Math.round(value * 100)}%</span>
    </div>
    <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  </div>
);
