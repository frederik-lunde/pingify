// src/routes/userRoutes.ts
import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';
import { handleValidationErrors } from '../middleware/validators/authValidator'; // Reuse this
import {
    updateMyProfileValidationRules,
    updateMyPasswordValidationRules,
} from '../middleware/validators/userValidator';

const router = Router();

router.use(authenticate); // Apply authentication middleware to all routes below

router.get('/me', userController.getMyProfile); // No input validation needed

router.patch(
    '/me',
    updateMyProfileValidationRules(),
    handleValidationErrors,
    userController.updateMyProfile
);

router.patch(
    '/me/password',
    updateMyPasswordValidationRules(),
    handleValidationErrors,
    userController.updateMyPassword
);

router.delete('/me', userController.deleteMyAccount); // No input validation needed

export default router;