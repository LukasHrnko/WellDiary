import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes';
import { setupAuth } from '../server/auth';

const app = express();

// Enable CORS for all origins in serverless environment
app.use(cors({
  credentials: true,
  origin: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup authentication
setupAuth(app);

// Register API routes
registerRoutes(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default async (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};