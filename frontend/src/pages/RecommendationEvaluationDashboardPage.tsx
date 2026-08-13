import React, { useState, useEffect } from 'react';
import {
  fetchRecommendationEvaluationApi,
  type EvaluationMetricsPayload,
} from '../services/adminEvaluationService';

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
    colorClass: string,
    barGradient: string
  ) => {
    const val = value ?? 0;
    const percent = Math.round(val * 100);

    return (
      <div className="bg-slate-800/70 border border-slate-700/70 rounded-2xl p-5 space-y-3 shadow-xl backdrop-blur-md hover:border-slate-600 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</span>
          <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${colorClass}`}>
            {percent}%
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {val.toFixed(4)}
          </span>
          <span className="text-xs text-slate-400">@ K={kValue}</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">{subtitle}</p>

        {/* Metric Progress Bar */}
        <div className="w-full h-2 bg-slate-900/80 rounded-full overflow-hidden border border-slate-700/40">
          <div
            className={`h-full bg-gradient-to-r ${barGradient} rounded-full transition-all duration-700`}
            style={{ width: `${Math.min(100, Math.max(5, percent))}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
              🛠️ Developer Diagnostics Dashboard
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Recommendation Evaluation Suite
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Benchmark recommendation algorithms using Precision@K, Recall@K, F1@K, Diversity, Novelty, and Catalog Coverage metrics.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-700/80 backdrop-blur-md">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Top-K Horizon
              </label>
              <select
                value={kValue}
                onChange={(e) => setKValue(parseInt(e.target.value, 10))}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={5}>K = 5</option>
                <option value={10}>K = 10</option>
                <option value={20}>K = 20</option>
              </select>
            </div>

            <button
              onClick={runBenchmarkEvaluation}
              disabled={loading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 self-end"
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
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* Strategy Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setSelectedStrategy('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedStrategy === 'all'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60'
          }`}
        >
          📊 All Strategies Comparison
        </button>

        <button
          onClick={() => setSelectedStrategy('hybrid')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedStrategy === 'hybrid'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60'
          }`}
        >
          ⚡ Hybrid Engine
        </button>

        <button
          onClick={() => setSelectedStrategy('collaborative')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedStrategy === 'collaborative'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60'
          }`}
        >
          👥 Collaborative Filtering
        </button>

        <button
          onClick={() => setSelectedStrategy('content')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedStrategy === 'content'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60'
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
          'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          'from-indigo-500 to-indigo-400'
        )}

        {renderMetricCard(
          'Recall@K',
          activeMetrics?.recallAtK,
          'Ratio of total relevant items captured in top-K recommendations.',
          'bg-purple-500/20 text-purple-300 border-purple-500/30',
          'from-purple-500 to-purple-400'
        )}

        {renderMetricCard(
          'F1@K Score',
          activeMetrics?.f1AtK,
          'Harmonic mean balancing Precision@K and Recall@K relevance.',
          'bg-pink-500/20 text-pink-300 border-pink-500/30',
          'from-pink-500 to-pink-400'
        )}

        {renderMetricCard(
          'Recommendation Diversity',
          activeMetrics?.diversityScore,
          'Variety across genre categories and distinct artist creators.',
          'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          'from-cyan-500 to-cyan-400'
        )}

        {renderMetricCard(
          'Novelty Score',
          activeMetrics?.noveltyScore,
          'Discovery factor rating less frequently played / hidden gem tracks.',
          'bg-amber-500/20 text-amber-300 border-amber-500/30',
          'from-amber-500 to-amber-400'
        )}

        {renderMetricCard(
          'Catalog Coverage',
          activeMetrics?.catalogCoverage,
          'Proportion of total available catalog songs covered by engine.',
          'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          'from-emerald-500 to-emerald-400'
        )}
      </div>

      {/* Clean Comparison Table Section */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-6 shadow-2xl space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          📋 Strategy Comparison Matrix (@ K={kValue})
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono border-b border-slate-700/60">
              <tr>
                <th className="py-3 px-4">Evaluation Metric</th>
                <th className="py-3 px-4 text-indigo-400">Content-Based</th>
                <th className="py-3 px-4 text-purple-400">Collaborative</th>
                <th className="py-3 px-4 text-emerald-400">Hybrid Engine</th>
                <th className="py-3 px-4 text-right">Optimal Leader</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40 font-mono">
              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-white">Precision@K</td>
                <td className="py-3 px-4">{(contentMetrics?.precisionAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.precisionAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">{(hybridMetrics?.precisionAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-white">Recall@K</td>
                <td className="py-3 px-4">{(contentMetrics?.recallAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.recallAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">{(hybridMetrics?.recallAtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-white">F1@K Score</td>
                <td className="py-3 px-4">{(contentMetrics?.f1AtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.f1AtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">{(hybridMetrics?.f1AtK ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-white">Diversity Score</td>
                <td className="py-3 px-4">{(contentMetrics?.diversityScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.diversityScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">{(hybridMetrics?.diversityScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-white">Novelty Score</td>
                <td className="py-3 px-4">{(contentMetrics?.noveltyScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.noveltyScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">{(hybridMetrics?.noveltyScore ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Hybrid
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4 font-sans font-semibold text-white">Catalog Coverage</td>
                <td className="py-3 px-4">{(contentMetrics?.catalogCoverage ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4">{(collabMetrics?.catalogCoverage ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-emerald-400 font-bold">{(hybridMetrics?.catalogCoverage ?? 0).toFixed(4)}</td>
                <td className="py-3 px-4 text-right font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Hybrid
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparative Visualization Section */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-6 shadow-2xl space-y-6">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          📊 Comparative Benchmark Visualization
        </h2>

        <div className="space-y-5">
          {/* F1 Score Bar Comparison */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>F1@K Overall Relevance Score</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-medium text-indigo-300">Content</span>
                <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((contentMetrics?.f1AtK ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-slate-300">
                  {((contentMetrics?.f1AtK ?? 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-medium text-purple-300">Collaborative</span>
                <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((collabMetrics?.f1AtK ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-slate-300">
                  {((collabMetrics?.f1AtK ?? 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-bold text-emerald-300">Hybrid Engine</span>
                <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((hybridMetrics?.f1AtK ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-emerald-400 font-bold">
                  {((hybridMetrics?.f1AtK ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Diversity Bar Comparison */}
          <div className="space-y-2 pt-2 border-t border-slate-700/40">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>Recommendation Diversity Factor</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-medium text-indigo-300">Content</span>
                <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((contentMetrics?.diversityScore ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-slate-300">
                  {((contentMetrics?.diversityScore ?? 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-medium text-purple-300">Collaborative</span>
                <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((collabMetrics?.diversityScore ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-slate-300">
                  {((collabMetrics?.diversityScore ?? 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-bold text-emerald-300">Hybrid Engine</span>
                <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((hybridMetrics?.diversityScore ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-[11px] font-mono text-emerald-400 font-bold">
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
