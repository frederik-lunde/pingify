// server/src/routes/alertRoutes.ts
// NO CHANGES NEEDED HERE. The incident count route is now in monitoringRoutes.
import { Router } from 'express';
import * as alertController from '../controllers/alertController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

// --- User Specific Routes ---
router.get('/user', alertController.getUserAlerts);
router.get('/user/stats', alertController.getUserAlertStats);
// REMOVED: /user/incidents/last24h (Moved to monitoring routes)

// --- User Actions ---
router.delete('/:alertId', alertController.dismissAlert);

// --- Website Specific Routes ---
router.get('/website/:websiteId', alertController.getAlertsByWebsite);

export default router;