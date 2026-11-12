import { Router } from 'express';
import { register, login, getMe } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

// Public auth endpoints
router.post('/register', register);
router.post('/login', login);

// Authenticated user profile endpoint (Requires valid JWT)
router.get('/me', requireAuth, getMe);

export default router;
