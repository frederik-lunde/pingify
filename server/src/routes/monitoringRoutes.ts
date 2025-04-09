// server/src/routes/monitoringRoutes.ts
import { Router } from 'express';
// --- UPDATED PATH ---
import * as monitoringController from '../controllers/monitorController'; // Corrected controller filename
import { authenticate } from '../middleware/authMiddleware'; // Ensure path is correct
// Import admin check middleware if you have one, e.g., isAdmin
// import { isAdmin } from '../middleware/authMiddleware';


const router = Router();

router.use(authenticate);

// --- Admin Routes ---
// GET all results across the system (paginated/filtered)
// Optional: Add isAdmin middleware if needed: router.get('/admin/results', isAdmin, monitoringController.getAllResults);
router.get('/admin/results', monitoringController.getAllResults);
// GET overall system stats (e.g., for admin dashboard)
// Optional: Add isAdmin middleware if needed: router.get('/admin/stats', isAdmin, monitoringController.getOverallStats);

router.get('/admin/stats', monitoringController.getOverallStats);

// --- User Routes ---
router.get('/user/results', monitoringController.getUserResults);
// GET aggregated stats for the user's monitored websites
// This endpoint now includes the incidentsLast24h field

router.get('/user/stats', monitoringController.getUserStats);
// --- NEW ROUTE FOR INCIDENT COUNT ---
router.get('/user/incidents/last24h', monitoringController.getUserIncidentCountLast24h); // <-- ADDED
router.get('/user/down-websites/last24h', monitoringController.getDownWebsitesLast24h);


// --- Website-Specific Routes ---
router.get('/website/:websiteId/results', monitoringController.getResultsByWebsite);
router.get('/website/:websiteId/stats', monitoringController.getWebsiteStats);
router.get('/website/:websiteId', monitoringController.getWebsiteDetails);

// --- Actions ---
router.post('/check/:websiteId', monitoringController.triggerWebsiteCheck);

export default router;
