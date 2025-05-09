
import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';
import { handleValidationErrors } from '../middleware/validators/authValidator'; 
import {
    updateMyProfileValidationRules,
    updateMyPasswordValidationRules,
} from '../middleware/validators/userValidator';

const router = Router();

router.use(authenticate); 

router.get('/me', userController.getMyProfile); 

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

router.delete('/me', userController.deleteMyAccount); 

export default router;