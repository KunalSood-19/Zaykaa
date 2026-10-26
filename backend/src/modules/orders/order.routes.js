import express from 'express';
import { createOrder, getOrderById, cancelOrder } from './order.controller.js';
import { resolveCustomerIdentity } from '../../middleware/identity.middleware.js';

const router = express.Router();

// Order routes resolve customer identity for access control and ownership
router.use(resolveCustomerIdentity);

// Customer places a new order
router.post('/', createOrder);

// Customer, restaurant, or delivery partner retrieves order details
router.get('/:id', getOrderById);

// Customer cancels an order before preparation begins
router.post('/:id/cancel', cancelOrder);

export default router;
