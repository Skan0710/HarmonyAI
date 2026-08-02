import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('HarmonyAI API Running');
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'HarmonyAI Backend API is running' });
});

const startServer = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[HarmonyAI Backend] Server is running on port ${PORT}`);
  });
};

startServer();
