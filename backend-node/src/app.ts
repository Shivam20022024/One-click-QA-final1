import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

import suitesRoutes from './routes/suites';
import executionRoutes from './routes/executions';
import projectsRoutes from './routes/projects';
import dashboardRoutes from './routes/dashboard';
import { ensureBucketsExist } from './utils/storage';
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Limit each IP to 10000 requests per `window`
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use('/api/', apiLimiter);

import discoveryRoutes from './routes/discovery';
import aiRoutes from './routes/ai';
import autonomousRoutes from './routes/autonomous';
import jiraRoutes from './routes/jira';
import healingRoutes from './routes/healing';

app.use('/api/v1/suites', suitesRoutes);
app.use('/api/v1/executions', executionRoutes);
app.use('/api/v1/projects', projectsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/discovery', discoveryRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/autonomous', autonomousRoutes);
app.use('/api/v1/jira', jiraRoutes);
app.use('/api/v1/healing', healingRoutes);

// Ensure Supabase buckets exist
ensureBucketsExist().catch(console.error);

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'novalantis-backend' });
});

export default app;
