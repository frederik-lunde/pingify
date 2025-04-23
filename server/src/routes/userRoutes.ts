// src/routes/userRoutes.ts
import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// All routes in this file are protected and operate on the currently authenticated user (/api/users/me/...)
router.use(authenticate); // Apply authentication middleware to all routes below

router.get('/me', userController.getMyProfile); // Reuse GET /me from auth or keep separate here
router.patch('/me', userController.updateMyProfile); // Use PATCH for partial updates
router.patch('/me/password', userController.updateMyPassword); // Specific endpoint for password
router.delete('/me', userController.deleteMyAccount);

export default router;