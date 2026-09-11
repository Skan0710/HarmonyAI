import React, { useState, useEffect } from 'react';
import {
  fetchRecommendationEvaluationApi,
  type EvaluationMetricsPayload,
} from '../services/adminEvaluationService';
import StatsCounter from '../components/ui/stats-counter';

export const RecommendationEvaluationDashboardPage: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<'content' | 'collaborative' | 'hybrid' | 'all'>('all');
  const [kValue, setKValue] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [contentMetrics, setContentMetrics] = useState<EvaluationMetricsPayload | null>(null);
  const [collabMetrics, setCollabMetrics] = useState<EvaluationMetricsPayload | null>(null);
  const [hybridMetrics, setHybridMetrics] = useState<EvaluationMetricsPayload | null>(null);

  const runBenchmarkEvaluation = async () => {
    setLoading(true);
    setError(null);

    try {
      const [resContent, resCollab, resHybrid] = await Promise.all([
        fetchRecommendationEvaluationApi('content', kValue),
        fetchRecommendationEvaluationApi('collaborative', kValue),
        fetchRecommendationEvaluationApi('hybrid', kValue),
      ]);

      if (resContent.metrics) setContentMetrics(resContent.metrics);
      if (resCollab.metrics) setCollabMetrics(resCollab.metrics);
      if (resHybrid.metrics) setHybridMetrics(resHybrid.metrics);

      if (resContent.error && resCollab.error && resHybrid.error) {
        setError(resHybrid.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run benchmark evaluation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runBenchmarkEvaluation();
  }, [kValue]);

  // Selected Active Metrics Payload based on tab
  const activeMetrics: EvaluationMetricsPayload | null =
    selectedStrategy === 'content'
      ? contentMetrics
      : selectedStrategy === 'collaborative'
      ? collabMetrics
      : hybridMetrics;

  const renderMetricCard = (
    title: string,
    value: number | undefined,
    subtitle: string,
    accentTone: 'accent' | 'gold'
  ) => {
    const val = value ?? 0;
    const percent = Math.round(val * 100);
    const badgeClass =
      accentTone === 'accent'
        ? 'bg-accent-wash text-accent border-accent/30'
        : 'bg-gold-wash text-gold border-gold/30';
    const barClass = accentTone === 'accent' ? 'bg-accent' : 'bg-gold';

    return (
      <div className="bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-5 space-y-3 hover:border-border-default transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">{title}</span>
          <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-[var(--radius-pill)] border ${badgeClass}`}>
            <StatsCounter value={percent} suffix="%" duration={1} />
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-display text-text-primary tracking-tight font-mono">
            <StatsCounter value={val} decimals={4} duration={1} />
          </span>
          <span className="text-xs text-text-tertiary">@ K={kValue}</span>
        </div>

        <p className="text-xs text-text-tertiary leading-relaxed">{subtitle}</p>

        {/* Metric Progress Bar */}
        <div className="w-full h-2 bg-surface-0/80 rounded-[var(--radius-pill)] overflow-hidden border border-border-subtle">
          <div
            className={`h-full ${barClass} rounded-[var(--radius-pill)] transition-all duration-700`}
            style={{ width: `${Math.min(100, Math.max(5, percent))}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-surface-1 border border-border-subtle p-6 sm:p-8">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-accent-wash rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[var(--radius-pill)] bg-accent-wash text-accent border border-accent/30 text-xs font-semibold">
              🛠️ Developer Diagnostics Dashboard
            </div>
            <h1 className="font-display text-2xl sm:text-4xl text-text-primary tracking-tight">
              Recommendation Evaluation Suite
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary max-w-2xl leading-relaxed">
              Benchmark recommendation algorithms using Precision@K, Recall@K, F1@K, Diversity, Novelty, and Catalog Coverage metrics.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 bg-surface-0/60 p-3 rounded-[var(--radius-lg)] border border-border-subtle">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
                Top-K Horizon
              </label>
              <select
                value={kValue}
                onChange={(e) => setKValue(parseInt(e.target.value, 10))}
                className="bg-surface-2 border border-border-default rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value={5}>K = 5</option>
                <option value={10}>K = 10</option>
                <option value={20}>K = 20</option>
              </select>
            </div>

            <button
              onClick={runBenchmarkEvaluation}
              disabled={loading}
              className="px-4 py-2.5 bg-accent hover:bg-accent-strong disabled:opacity-50 text-text-on-accent font-semibold text-xs rounded-[var(--radius-pill)] transition-colors flex items-center gap-2 self-end cursor-pointer"
            >
              {loading ? (
                <span className="animate-spin text-sm">⏳</span>
              ) : (
                <span>🔄 Run Benchmark</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[var(--radius-lg)] bg-danger-wash border border-danger/30 text-danger text-xs font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* Strategy Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-3 overflow-x-auto">
        <button
          onClick={() => setSelectedStrategy('all')}
          className={`px-4 py-2 rounded-[var(--radius-md)] text-xs font-bold transition-all cursor-pointer ${
            selectedStrategy === 'all'
              ? 'bg-accent text-text-on-accent'
              : 'bg-surface-1 text-text-secondary hover:text-text-primary border border-border-default'
          }`}
        >
          📊 All Strategies Comparison
        </button>

        <button
          onClick={() => setSelectedStrategy('hybrid')}
          className={`px-4 py-2 rounded-[var(--radius-md)] text-xs font-bold transition-all cursor-pointer ${
            selectedStrategy === 'hybrid'
              ? 'bg-accent text-text-on-accent'
              : 'bg-surface-1 text-text-secondary hover:text-text-primary border border-border-default'
          }`}
        >
          ⚡ Hybrid Engine
        </button>

        <button
          onClick={() => setSelectedStrategy('collaborative')}
          className={`px-4 py-2 rounded-[var(--radius-md)] text-xs font-bold transition-all cursor-pointer ${
            selectedStrategy === 'collaborative'
              ? 'bg-accent text-text-on-accent'
              : 'bg-surface-1 text-text-secondary hover:text-text-primary border border-border-default'
          }`}
        >
          👥 Collaborative Filtering
        </button>

        <button
          onClick={() => setSelectedStrategy('content')}
          className={`px-4 py-2 rounded-[var(--radius-md)] text-xs font-bold transition-all cursor-pointer ${
            selectedStrategy === 'content'
              ? 'bg-accent text-text-on-accent'
              : 'bg-surface-1 text-text-secondary hover:text-text-primary border border-border-default'
          }`}
        >
          🎵 Content-Based
        </button>
      </div>

      {/* 6 Separate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {renderMetricCard(
          'Precision@K',
          activeMetrics?.precisionAtK,
          'Ratio of recommended items matching relevant user interactions.',
          'accent'
        )}

        {renderMetricCard(
          'Recall@K',
          activeMetrics?.recallAtK,
          'Ratio of total relevant items captured in top-K recommendations.',
          'gold'
        )}

        {renderMetricCard(
          'F1@K Score',
          activeMetrics?.f1AtK,
          'Harmonic mean balancing Precision@K and Recall@K relevance.',
          'accent'
        )}

        {renderMetricCard(
          'Recommendation Diversity',
          activeMetrics?.diversityScore,
          'Variety across genre categories and distinct artist creators.',
          'gold'
        )}

        {renderMetricCard(
          'Novelty Score',
          activeMetrics?.noveltyScore,
          'Discovery factor rating less frequently played / hidden gem tracks.',
          'accent'
        )}

        {renderMetricCard(
          'Catalog Coverage',
          activeMetrics?.catalogCoverage,
          'Proportion of total available catalog songs covered by engine.',
          'gold'
        )}
      </div>

      {/* Clean Comparison Table Section */}
      <div className="bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 space-y-4">
        <h2 className="text-lg font-bold text-text-primary tracking-tight flex items-center gap-2">
          📋 Strategy Comparison Matrix (@ K={kValue})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-secondary">
            <thead className="bg-surface-0/80 text-text-tertiary uppercase font-mono border-b border-border-default">
              <tr>
                <th className="py-3 px-4">Evaluation Metric</th>
                <th className="py-3 px-4 text-text-secondary">Content-Based</th>
                <th className="py-3 px-4 text-gold">Collaborative</th>
                <th className="py-3 px-4 text-accent">Hybrid Engine</th>
                <th className="py-3 px-4 text-right">Optimal Leader</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-mono">
              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-text-primary">Precision@K</td>
                <td className="py-3 px-4">{(contentMetrics?.precisionAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.precisionAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-accent font-bold">{(hybridMetrics?.precisionAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-[var(--radius-pill)] bg-accent-wash text-accent border border-accent/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-text-primary">Recall@K</td>
                <td className="py-3 px-4">{(contentMetrics?.recallAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.recallAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-accent font-bold">{(hybridMetrics?.recallAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-[var(--radius-pill)] bg-accent-wash text-accent border border-accent/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-text-primary">F1@K Score</td>
                <td className="py-3 px-4">{(contentMetrics?.f1AtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.f1AtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-accent font-bold">{(hybridMetrics?.f1AtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-[var(--radius-pill)] bg-accent-wash text-accent border border-accent/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-text-primary">Diversity Score</td>
                <td className="py-3 px-4">{(contentMetrics?.diversityScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.diversityScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-accent font-bold">{(hybridMetrics?.diversityScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-[var(--radius-pill)] bg-accent-wash text-accent border border-accent/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-text-primary">Novelty Score</td>
                <td className="py-3 px-4">{(contentMetrics?.noveltyScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.noveltyScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-accent font-bold">{(hybridMetrics?.noveltyScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-[var(--radius-pill)] bg-accent-wash text-accent border border-accent/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-text-primary">Catalog Coverage</td>
                <td className="py-3 px-4">{(contentMetrics?.catalogCoverage ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.catalogCoverage ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-accent font-bold">{(hybridMetrics?.catalogCoverage ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-[var(--radius-pill)] bg-accent-wash text-accent border border-accent/30">
                    Hybrid
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparative Visualization Section */}
      <div className="bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 space-y-6">
        <h2 className="text-lg font-bold text-text-primary tracking-tight flex items-center gap-2">
          📊 Comparative Benchmark Visualization
        </h2>

        <div className="space-y-5">
          {/* F1 Score Bar Comparison */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-text-secondary">
              <span>F1@K Overall Relevance Score</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-medium text-text-tertiary">Content</span>
                <div className="flex-1 bg-surface-0 rounded-[var(--radius-pill)] h-3 overflow-hidden">
                  <div
                    className="bg-border-strong h-full rounded-[var(--radius-pill)] transition-all duration-500"
                    style={{ width: `${Math.round((contentMetrics?.f1AtK ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-text-secondary">
                  {((contentMetrics?.f1AtK ?? 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-medium text-gold">Collaborative</span>
                <div className="flex-1 bg-surface-0 rounded-[var(--radius-pill)] h-3 overflow-hidden">
                  <div
                    className="bg-gold h-full rounded-[var(--radius-pill)] transition-all duration-500"
                    style={{ width: `${Math.round((collabMetrics?.f1AtK ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-text-secondary">
                  {((collabMetrics?.f1AtK ?? 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-bold text-accent">Hybrid Engine</span>
                <div className="flex-1 bg-surface-0 rounded-[var(--radius-pill)] h-3 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-[var(--radius-pill)] transition-all duration-500"
                    style={{ width: `${Math.round((hybridMetrics?.f1AtK ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-accent font-bold">
                  {((hybridMetrics?.f1AtK ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Diversity Bar Comparison */}
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <div className="flex justify-between text-xs font-semibold text-text-secondary">
              <span>Recommendation Diversity Factor</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-medium text-text-tertiary">Content</span>
                <div className="flex-1 bg-surface-0 rounded-[var(--radius-pill)] h-3 overflow-hidden">
                  <div
                    className="bg-border-strong h-full rounded-[var(--radius-pill)] transition-all duration-500"
                    style={{ width: `${Math.round((contentMetrics?.diversityScore ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-text-secondary">
                  {((contentMetrics?.diversityScore ?? 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-medium text-gold">Collaborative</span>
                <div className="flex-1 bg-surface-0 rounded-[var(--radius-pill)] h-3 overflow-hidden">
                  <div
                    className="bg-gold h-full rounded-[var(--radius-pill)] transition-all duration-500"
                    style={{ width: `${Math.round((collabMetrics?.diversityScore ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-text-secondary">
                  {((collabMetrics?.diversityScore ?? 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-bold text-accent">Hybrid Engine</span>
                <div className="flex-1 bg-surface-0 rounded-[var(--radius-pill)] h-3 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-[var(--radius-pill)] transition-all duration-500"
                    style={{ width: `${Math.round((hybridMetrics?.diversityScore ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-accent font-bold">
                  {((hybridMetrics?.diversityScore ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
