import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter from './modules/auth/auth.routes.js';
import restaurantRouter from './modules/restaurants/restaurant.routes.js';
import deliveryRouter from './modules/delivery/delivery.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

const app = express();

// Middleware: JSON and URL-encoded body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(frontendDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Zaykaa API is running'
  });
});

// Authentication module routes
app.use('/api/auth', authRouter);

// Restaurant module routes
app.use('/api/restaurants', restaurantRouter);

// Delivery partner module routes
app.use('/api/partners', deliveryRouter);

// API 404 handler: matches any unhandled /api route
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `API endpoint '${req.originalUrl}' not found`
    }
  });
});

// Centralized error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected server error occurred',
      ...(err.details ? { details: err.details } : {}),
      ...(isDevelopment && err.stack ? { stack: err.stack } : {})
    }
  });
});

export default app;
