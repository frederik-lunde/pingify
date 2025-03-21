import { Router } from 'express';
import * as alertController from '../controllers/alertController';

const router = Router();

router.get('/', alertController.getRecentAlerts);
router.get('/websites/:websiteId', alertController.getAlertsByWebsite);
router.get('/stats', alertController.getAlertStats);

export default router;