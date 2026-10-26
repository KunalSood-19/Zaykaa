import express from 'express';
import { listRestaurants, getRestaurantById } from './restaurant.controller.js';
import { getRestaurantMenu } from '../menus/menu.controller.js';

const router = express.Router();

// Restaurant discovery (Public)
router.get('/', listRestaurants);

// Single restaurant details (Public)
router.get('/:id', getRestaurantById);

// Restaurant menu items grouped by categories (Public)
router.get('/:id/menu', getRestaurantMenu);

export default router;
