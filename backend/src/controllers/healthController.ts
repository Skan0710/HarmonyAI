import { Request, Response } from 'express';
import { checkSupabaseConnection } from '../config/supabase.js';

export const getHealthStatus = async (req: Request, res: Response): Promise<void> => {
  const isHealthy = await checkSupabaseConnection();

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    uptime: `${process.uptime().toFixed(2)}s`,
    timestamp: new Date().toISOString(),
    database: {
      provider: 'supabase',
      project: 'HarmonyAI (xyjfwwztbtsqzegargpa)',
      status: isHealthy ? 'connected' : 'disconnected',
    },
  });
};
