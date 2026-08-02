import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api';

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
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-4">Welcome to HarmonyAI</h1>
      <p className="text-slate-400 mb-6">
        Your full-stack application foundation is ready.
      </p>

      <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-2 text-slate-200">Backend API Health</h2>
        {loading ? (
          <p className="text-slate-400 text-sm">Checking backend health...</p>
        ) : health ? (
          <div className="text-sm space-y-1 text-slate-300">
            <p><span className="font-medium text-slate-400">API Status:</span> <span className="text-emerald-400 font-semibold">{health.status}</span></p>
            <p><span className="font-medium text-slate-400">Uptime:</span> {health.uptime}</p>
            <p><span className="font-medium text-slate-400">Database:</span> <span className="text-emerald-400">{health.database.status}</span></p>
          </div>
        ) : (
          <p className="text-amber-400 text-sm">Unable to connect to backend API (ensure backend is running on port 5000).</p>
        )}
      </div>
    </div>
  );
};
