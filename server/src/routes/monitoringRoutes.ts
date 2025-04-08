// server/src/routes/monitoringRoutes.ts
import { Router } from 'express';
// --- UPDATED PATH ---
import * as monitoringController from '../controllers/monitorController'; // Corrected controller filename
import { authenticate } from '../middleware/authMiddleware'; // Ensure path is correct
// Import admin check middleware if you have one, e.g., isAdmin
// import { isAdmin } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication middleware to all monitoring routes
router.use(authenticate);

// --- Admin Routes ---
// GET all results across the system (paginated/filtered)
// Optional: Add isAdmin middleware if needed: router.get('/admin/results', isAdmin, monitoringController.getAllResults);
router.get('/admin/results', monitoringController.getAllResults);
// GET overall system stats (e.g., for admin dashboard)
// Optional: Add isAdmin middleware if needed: router.get('/admin/stats', isAdmin, monitoringController.getOverallStats);
router.get('/admin/stats', monitoringController.getOverallStats);

// --- User Routes ---
// GET results for websites the user monitors (paginated/filtered)
router.get('/user/results', monitoringController.getUserResults);
// GET aggregated stats for the user's monitored websites
// This endpoint now includes the incidentsLast24h field
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
