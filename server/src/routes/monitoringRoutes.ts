// server/src/routes/monitoringRoutes.ts
import { Router } from 'express';
import * as monitoringController from '../controllers/monitorController'; // Correct controller filename
import { authenticate } from '../middleware/authMiddleware'; // Ensure path is correct

const router = Router();

// Apply authentication middleware to all monitoring routes
router.use(authenticate);

// --- Admin Routes ---
// GET all results across the system (paginated/filtered)
router.get('/admin/results', monitoringController.getAllResults);
// GET overall system stats (e.g., for admin dashboard)
router.get('/admin/stats', monitoringController.getOverallStats);

// --- User Routes ---
// GET results for websites the user monitors (paginated/filtered)
router.get('/user/results', monitoringController.getUserResults);
// GET aggregated stats for the user's monitored websites
router.get('/user/stats', monitoringController.getUserStats);

// --- Website-Specific Routes (Access controlled within controller) ---
// GET results for a single website (paginated/filtered)
router.get('/website/:websiteId/results', monitoringController.getResultsByWebsite);
// GET stats for a single website
router.get('/website/:websiteId/stats', monitoringController.getWebsiteStats);
// GET detailed view data (chart, recent checks, etc.) for a single website
router.get('/website/:websiteId', monitoringController.getWebsiteDetails);


// --- Actions ---
// POST to trigger an immediate check for a specific website
router.post('/check/:websiteId', monitoringController.triggerWebsiteCheck);

export default router;