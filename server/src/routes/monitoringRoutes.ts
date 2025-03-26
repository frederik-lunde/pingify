import { Router } from 'express';
import * as monitoringController from '../controllers/monitorController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

// Admin routes
router.get('/admin/results', monitoringController.getAllResults);
router.get('/admin/stats', monitoringController.getOverallStats);

// User routes
router.get('/user/results', monitoringController.getUserResults);
router.get('/user/stats', monitoringController.getUserStats);

// Website-specific routes (accessible to users who have access)
router.get('/website/:websiteId/results', monitoringController.getResultsByWebsite);
router.get('/website/:websiteId/stats', monitoringController.getWebsiteStats);

// Trigger an immediate check for a website
router.post('/check/:websiteId', monitoringController.triggerWebsiteCheck);

export default router;