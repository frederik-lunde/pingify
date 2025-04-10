// server/src/routes/monitoringRoutes.ts
import { Router } from 'express';
import * as monitoringController from '../controllers/monitorController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

// --- Admin Routes ---
// Optional: Add isAdmin middleware if needed
router.get('/admin/results', monitoringController.getAllResults);
router.get('/admin/stats', monitoringController.getOverallStats);

// --- User Routes ---
router.get('/user/results', monitoringController.getUserResults);
router.get('/user/stats', monitoringController.getUserStats);

// --- Website-Specific Routes ---
router.get('/website/:websiteId/results', monitoringController.getResultsByWebsite);
router.get('/website/:websiteId/stats', monitoringController.getWebsiteStats);
// This now includes incident details
router.get('/website/:websiteId', monitoringController.getWebsiteDetails);

// --- Actions ---
router.post('/check/:websiteId', monitoringController.triggerWebsiteCheck);

export default router;