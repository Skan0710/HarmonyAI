import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'HarmonyAI Backend API is running' });
});

app.listen(PORT, () => {
  console.log(`[HarmonyAI Backend] Server is running on port ${PORT}`);
});
