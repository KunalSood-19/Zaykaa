import express from 'express';
import { getProfile, updateProfile, getCustomerOrders } from './customer.controller.js';
import { resolveCustomerIdentity } from '../../middleware/identity.middleware.js';

const router = express.Router();

// All customer routes require resolved customer identity
router.use(resolveCustomerIdentity);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/orders', getCustomerOrders);

export default router;
