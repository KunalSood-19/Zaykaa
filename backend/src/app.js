import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './modules/auth/auth.routes.js';
import restaurantRoutes from './modules/restaurants/restaurant.routes.js';
import customerRoutes from './modules/customers/customer.routes.js';
import orderRoutes from './modules/orders/order.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

const app = express();

// Middleware: JSON and URL-encoded body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redirect root '/' to customer portal
app.get('/', (req, res) => {
  res.redirect('/customer/index.html');
});

// Serve static frontend files
app.use(express.static(frontendDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Zaykaa API is running'
  });
});

// Feature routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);

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

  let errorCode = err.code;
  if (!errorCode) {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      errorCode = 'INVALID_JSON_BODY';
    } else if (statusCode === 400) {
      errorCode = 'BAD_REQUEST';
    } else if (statusCode === 404) {
      errorCode = 'NOT_FOUND';
    } else {
      errorCode = 'INTERNAL_SERVER_ERROR';
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected server error occurred',
      ...(err.details ? { details: err.details } : {}),
      ...(isDevelopment && err.stack ? { stack: err.stack } : {})
    }
  });
});

export default app;

