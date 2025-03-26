// server/src/routes/alertRoutes.ts
import { Router } from 'express';
import * as alertController from '../controllers/alertController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Admin routes
router.get('/admin/all', alertController.getRecentAlerts);
router.get('/admin/stats', alertController.getAlertStats);

// User routes
router.get('/user', alertController.getUserAlerts);
router.get('/user/unread', alertController.getUserUnreadAlerts);
router.post('/user/read/:alertId', alertController.markAlertAsRead);
router.post('/user/read-all', alertController.markAllAlertsAsRead);
router.get('/user/stats', alertController.getUserAlertStats);

export default router;