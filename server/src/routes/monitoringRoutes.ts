import { Router } from 'express';
import * as monitoringController from '../controllers/monitorController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Admin routes
router.get('/admin/results', authenticate, monitoringController.getAllResults);
router.get('/admin/stats', authenticate, monitoringController.getOverallStats);

// User routes
router.get('/user/results', authenticate, monitoringController.getUserResults);
router.get('/user/stats', authenticate, monitoringController.getUserStats);

// Website-specific routes (accessible to users who have access)
router.get('/website/:websiteId/results', authenticate, monitoringController.getResultsByWebsite);
router.get('/website/:websiteId/stats', authenticate, monitoringController.getWebsiteStats);

// Trigger an immediate check for a website
router.post('/check/:websiteId', authenticate, monitoringController.triggerWebsiteCheck);

export default router;