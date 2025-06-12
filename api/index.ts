import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes';
import { setupAuth } from '../server/auth';

const app = express();

// Enable CORS for Vercel deployment
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-vercel-domain.vercel.app']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup authentication
setupAuth(app);

// Register API routes
registerRoutes(app);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default app;