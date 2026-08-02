import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface HealthData {
  status: string;
  uptime: string;
  timestamp: string;
  database: {
    status: string;
    readyState: number;
  };
}

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    apiClient<HealthData>('/health')
      .then((res) => {
        if (res.data) {
          setHealth(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
          Welcome back, {user?.name || 'User'}!
        </h1>
        <p className="text-slate-400">
          Your full-stack application workspace is active and authenticated.
        </p>
      </div>

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg space-y-4">
        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>System Status & Health</span>
        </h2>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <span>Checking backend health status...</span>
          </div>
        ) : health ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                API Status
              </span>
              <span className="text-emerald-400 font-bold text-lg">{health.status}</span>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Database
              </span>
              <span className="text-emerald-400 font-bold text-lg">{health.database.status}</span>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-lg">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Server Uptime
              </span>
              <span className="text-indigo-300 font-semibold text-base">{health.uptime}</span>
            </div>
          </div>
        ) : (
          <p className="text-amber-400 text-sm">
            Unable to connect to backend API server. Please check port 5000.
          </p>
        )}
      </div>

      {user && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
          <h2 className="text-lg font-semibold text-slate-200 mb-3">User Session Metadata</h2>
          <div className="text-sm space-y-2 text-slate-300">
            <p><span className="text-slate-400 font-medium">User ID:</span> <code className="text-indigo-300 bg-slate-950 px-2 py-0.5 rounded">{user.id}</code></p>
            <p><span className="text-slate-400 font-medium">Email:</span> {user.email}</p>
            <p><span className="text-slate-400 font-medium">Account Created:</span> {new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      )}
    </div>
  );
};
