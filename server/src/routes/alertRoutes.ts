import { Router } from 'express';
import * as alertController from '../controllers/alertController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Admin routes
router.get('/admin/all', authenticate, alertController.getRecentAlerts);
router.get('/admin/stats', authenticate, alertController.getAlertStats);

// User routes
router.get('/user', authenticate, alertController.getUserAlerts);
router.get('/user/stats', authenticate, alertController.getUserAlertStats);

// Website-specific routes (accessible to users who have access)
router.get('/website/:websiteId', authenticate, alertController.getAlertsByWebsite);

export default router;