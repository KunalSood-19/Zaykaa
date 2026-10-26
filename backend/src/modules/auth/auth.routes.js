import { Router } from 'express';
import defaultAuthController from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/register', defaultAuthController.register);
router.post('/login', defaultAuthController.login);
router.get('/me', authenticateToken, defaultAuthController.getMe);

export default router;
