import { Request, Response } from 'express';
import mongoose from 'mongoose';

export const getHealthStatus = (req: Request, res: Response): void => {
  const dbStateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbStateCode = mongoose.connection.readyState;
  const dbStatus = dbStateMap[dbStateCode] || 'unknown';

  const isHealthy = dbStateCode === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    uptime: `${process.uptime().toFixed(2)}s`,
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      readyState: dbStateCode,
    },
  });
};
