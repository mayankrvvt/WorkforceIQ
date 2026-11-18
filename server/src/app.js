import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import skillRoutes from './routes/skill.routes.js';
import aiRoutes from './routes/ai.routes.js';
import jobRoleRoutes from './routes/job-role.routes.js';
import employerRoutes from './routes/employer.routes.js';
import matchingRoutes from './routes/matching.routes.js';

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const configuredClientOrigin =
  process.env.CLIENT_URL || 'http://localhost:5173';
const clientOriginUrl = new URL(configuredClientOrigin);
const clientOrigins = [clientOriginUrl.origin];

if (
  process.env.NODE_ENV !== 'production' &&
  ['localhost', '127.0.0.1'].includes(clientOriginUrl.hostname)
) {
  const loopbackAlias =
    clientOriginUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  clientOrigins.push(
    `${clientOriginUrl.protocol}//${loopbackAlias}${clientOriginUrl.port ? `:${clientOriginUrl.port}` : ''}`,
  );
}

app.use(helmet());
app.use(
  cors({
    origin: clientOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

app.get('/api/health', (_request, response) => {
  response.json({
    success: true,
    service: 'WorkforceIQ API',
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/job-roles', jobRoleRoutes);
app.use('/api/employers', employerRoutes);
app.use('/api/matching', matchingRoutes);

app.use('/api', (_request, response) => {
  response.status(404).json({
    success: false,
    message: 'API route not found',
  });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
  });
});

export default app;
