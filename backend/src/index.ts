import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { checkSupabaseConnection } from './config/supabase.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import genreRoutes from './routes/genreRoutes.js';
import artistRoutes from './routes/artistRoutes.js';
import albumRoutes from './routes/albumRoutes.js';
import songRoutes from './routes/songRoutes.js';
import musicRoutes from './routes/musicRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import playlistRoutes from './routes/playlistRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import adminRecommendationRoutes from './routes/adminRecommendationRoutes.js';
import assistantRoutes from './routes/assistantRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// --- Security Headers ---
app.use(helmet());

// --- CORS Configuration ---
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || !isProduction) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// --- Body Parsing with Size Limits ---
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// --- Global Rate Limiting ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Auth endpoints get their own per-route limiters (see authRoutes.ts) — register
// and login are split so a legitimate login-heavy session can't eat into the
// budget an attacker would need for mass signup, or vice versa.

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('HarmonyAI API Running');
});

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/genres', genreRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin/recommendations', adminRecommendationRoutes);
app.use('/api/assistant', assistantRoutes);

// 404 handler for undefined API routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
  });
});

// Centralized error handling middleware
app.use((err: any, _req: Request, res: Response, _next: any) => {
  const statusCode = err.statusCode || err.status || 500;

  // In production, sanitize error messages to avoid leaking internal details
  let message = 'Internal server error';
  if (statusCode < 500) {
    // Client errors: safe to show the message
    message = err.message || message;
  } else if (!isProduction && err.message) {
    // Development: show full error details
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
});

const startServer = async (): Promise<void> => {
  await checkSupabaseConnection();
  app.listen(PORT, () => {
    console.log(`[HarmonyAI Backend] Server is running on port ${PORT}`);
  });
};

startServer();
